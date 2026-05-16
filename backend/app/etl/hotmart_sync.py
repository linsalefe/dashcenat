"""Sync de vendas Hotmart: fetch API → upsert mkt.vendas_hotmart → matching com tracking."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import and_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.integracoes import Integracao
from app.models.mkt import VendaHotmart
from app.models.tracking import TrackingEvento
from app.services.crypto import decrypt_json
from app.services.hotmart import HotmartClient, HotmartError, parse_sale

log = logging.getLogger("hotmart_sync")


async def get_hotmart_client(db: AsyncSession) -> HotmartClient | None:
    res = await db.execute(select(Integracao).where(Integracao.servico == "hotmart"))
    integ = res.scalar_one_or_none()
    if not integ or not integ.ativo or not integ.credentials_cifradas:
        return None
    creds = decrypt_json(integ.credentials_cifradas)
    cid = creds.get("client_id")
    cs = creds.get("client_secret")
    bt = creds.get("basic_token")
    if not cid or not cs:
        return None
    return HotmartClient(client_id=cid, client_secret=cs, basic_token=bt)


# Statuses puxados por padrão: APPROVED (pré-prazo de reembolso), COMPLETE (vendas
# fechadas definitivamente, status mais comum em catálogos com renovação), REFUNDED
# (pra refletir reembolsos no banco — o UPSERT atualiza a linha de APPROVED→REFUNDED
# quando a Hotmart muda o status).
DEFAULT_STATUSES = ("APPROVED", "COMPLETE", "REFUNDED")


async def sync_hotmart(
    db: AsyncSession,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    transaction_status: str | list[str] | tuple[str, ...] | None = None,
) -> dict[str, Any]:
    """Sincroniza vendas Hotmart no período. Idempotente (upsert por `transacao`).

    `transaction_status` pode ser uma string (1 status), lista de strings (vários),
    ou None pra usar o default APPROVED+COMPLETE+REFUNDED.
    """
    client = await get_hotmart_client(db)
    if not client:
        raise HotmartError("Hotmart não configurado ou inativo")

    # Defaults: últimos 7 dias
    if not start_date:
        start_date = datetime.utcnow() - timedelta(days=7)
    if not end_date:
        end_date = datetime.utcnow()

    if transaction_status is None:
        statuses: tuple[str, ...] = DEFAULT_STATUSES
    elif isinstance(transaction_status, str):
        statuses = (transaction_status,)
    else:
        statuses = tuple(transaction_status)

    total = 0
    novos = 0
    matched = 0
    por_status: dict[str, int] = {}
    erros: list[str] = []

    try:
        for status in statuses:
            count_status = 0
            async for raw in client.fetch_sales(
                start_date=start_date,
                end_date=end_date,
                transaction_status=status,
            ):
                total += 1
                count_status += 1
                try:
                    parsed = parse_sale(raw)
                    if not parsed.get("transacao"):
                        erros.append("venda sem transacao")
                        continue
                    resultado = await _upsert_venda(db, parsed)
                    if resultado["inserido"]:
                        novos += 1
                    if resultado["matched"]:
                        matched += 1
                except Exception as e:
                    erros.append(f"[{status}] {str(e)[:200]}")
                    log.exception("erro processando venda")
            por_status[status] = count_status

        await db.commit()

        # Atualiza metadados da integração
        await db.execute(
            update(Integracao)
            .where(Integracao.servico == "hotmart")
            .values(
                ultimo_sync=datetime.utcnow(),
                ultimo_sync_status="ok",
                ultimo_sync_erro=None,
                ultimo_sync_total=total,
            )
        )
        await db.commit()

        return {
            "ok": True,
            "total": total,
            "novos": novos,
            "matched": matched,
            "por_status": por_status,
            "erros": erros[:10],
            "range": {"start": start_date.isoformat(), "end": end_date.isoformat()},
        }
    except Exception as e:
        await db.rollback()
        await db.execute(
            update(Integracao)
            .where(Integracao.servico == "hotmart")
            .values(
                ultimo_sync=datetime.utcnow(),
                ultimo_sync_status="erro",
                ultimo_sync_erro=str(e)[:500],
            )
        )
        await db.commit()
        raise


async def _upsert_venda(db: AsyncSession, parsed: dict[str, Any]) -> dict[str, Any]:
    """Insert ou update por transacao. Devolve {inserido, matched}.

    Estratégia de matching (last-touch):
    1. Se `parsed['anon_id_match']` veio do `purchase.tracking.source` (cn_aid do snippet)
       → busca o último evento de tracking desse anon_id e enriquece UTMs faltantes.
    2. Se não tem anon_id mas tem email → matching por email (legado, menos preciso).
    """
    stmt = pg_insert(VendaHotmart).values(**parsed)
    stmt = stmt.on_conflict_do_update(
        index_elements=[VendaHotmart.transacao],
        set_={
            k: stmt.excluded[k]
            for k in parsed.keys()
            if k != "transacao"
        },
    ).returning(
        VendaHotmart.id,
        VendaHotmart.cliente_email,
        VendaHotmart.data_venda,
    )
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        return {"inserido": False, "matched": False}

    venda_id, email, data_venda = row
    matched = False
    update_vals: dict[str, Any] = {}

    anon_id = parsed.get("anon_id_match")
    tem_utm = bool(parsed.get("utm_source"))

    # ----- 1) Match por anon_id (alta confiança, last-touch) -----
    if anon_id:
        last_event = await _last_touch_por_anon_id(db, anon_id, data_venda)
        if last_event:
            # Enriquecer UTMs faltantes a partir do último evento do visitante
            for k in ("utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"):
                if not parsed.get(k) and last_event.get(k):
                    update_vals[k] = last_event[k]
            matched = True
            # já marcado em parsed como hotmart_anon_id, mantém
        else:
            # anon_id veio do src mas não temos eventos rastreados
            # (cookie expirou ou tracking nunca chegou no backend)
            matched = bool(parsed.get("utm_source"))

    # ----- 2) Match por email (fallback, só se não veio anon_id) -----
    elif email and not tem_utm:
        matched_info = await _match_tracking_email(db, email, data_venda)
        if matched_info:
            update_vals.update({
                "utm_source": matched_info.get("utm_source"),
                "utm_medium": matched_info.get("utm_medium"),
                "utm_campaign": matched_info.get("utm_campaign"),
                "utm_term": matched_info.get("utm_term"),
                "utm_content": matched_info.get("utm_content"),
                "matched_via": "email",
                "anon_id_match": matched_info.get("anon_id"),
            })
            matched = True

    if update_vals:
        await db.execute(
            update(VendaHotmart).where(VendaHotmart.id == venda_id).values(**update_vals)
        )

    return {"inserido": True, "matched": matched}


async def _last_touch_por_anon_id(
    db: AsyncSession,
    anon_id: str,
    data_venda: datetime | None,
) -> dict[str, Any] | None:
    """Pega o último evento ANTES (ou até) da venda do anon_id que tenha utm_source.

    Last-touch: pega o último UTM tocado antes da venda. Se não tem evento com UTM
    antes da venda, cai pra qualquer evento com UTM do mesmo anon_id.
    """
    if not anon_id:
        return None

    limite = data_venda or datetime.utcnow()

    # Last-touch: último evento com utm_source até a data da venda
    q = (
        select(
            TrackingEvento.utm_source,
            TrackingEvento.utm_medium,
            TrackingEvento.utm_campaign,
            TrackingEvento.utm_term,
            TrackingEvento.utm_content,
            TrackingEvento.created_at,
        )
        .where(
            and_(
                TrackingEvento.anon_id == anon_id,
                TrackingEvento.created_at <= limite,
                TrackingEvento.utm_source.isnot(None),
            )
        )
        .order_by(TrackingEvento.created_at.desc())
        .limit(1)
    )
    r = await db.execute(q)
    row = r.first()
    if row:
        return {
            "utm_source": row.utm_source,
            "utm_medium": row.utm_medium,
            "utm_campaign": row.utm_campaign,
            "utm_term": row.utm_term,
            "utm_content": row.utm_content,
        }

    # Fallback: qualquer evento com UTM do mesmo anon_id (sem limite de data)
    q2 = (
        select(
            TrackingEvento.utm_source,
            TrackingEvento.utm_medium,
            TrackingEvento.utm_campaign,
            TrackingEvento.utm_term,
            TrackingEvento.utm_content,
        )
        .where(
            and_(
                TrackingEvento.anon_id == anon_id,
                TrackingEvento.utm_source.isnot(None),
            )
        )
        .order_by(TrackingEvento.created_at.desc())
        .limit(1)
    )
    r2 = await db.execute(q2)
    row2 = r2.first()
    if row2:
        return {
            "utm_source": row2.utm_source,
            "utm_medium": row2.utm_medium,
            "utm_campaign": row2.utm_campaign,
            "utm_term": row2.utm_term,
            "utm_content": row2.utm_content,
        }
    return None


async def _match_tracking_email(
    db: AsyncSession,
    email: str,
    data_venda: datetime | None,
) -> dict[str, Any] | None:
    """
    Estratégia de match:
    1. Procura tracking.eventos de tipo='conversion' com mesmo email em metadata
       em janela de ±48h da data_venda.
    2. Se não, qualquer evento (incluindo pageview) com mesmo email.

    Pra isso, o snippet deve passar email no metadata. Ex: `cenatTrack('conversion', {email: '...', ...})`.
    """
    if not email:
        return None

    # janela: ±48h da venda (ou últimos 30 dias se data_venda for None)
    if data_venda:
        ini = data_venda - timedelta(hours=48)
        fim = data_venda + timedelta(hours=48)
    else:
        ini = datetime.utcnow() - timedelta(days=30)
        fim = datetime.utcnow()

    # 1ª tentativa: conversion com email no metadata
    q = (
        select(
            TrackingEvento.utm_source,
            TrackingEvento.utm_medium,
            TrackingEvento.utm_campaign,
            TrackingEvento.utm_term,
            TrackingEvento.utm_content,
            TrackingEvento.anon_id,
        )
        .where(
            and_(
                TrackingEvento.created_at >= ini,
                TrackingEvento.created_at <= fim,
                TrackingEvento.tipo == "conversion",
                TrackingEvento.metadata_["email"].astext.ilike(email),
            )
        )
        .order_by(TrackingEvento.created_at.desc())
        .limit(1)
    )
    r = await db.execute(q)
    row = r.first()
    if row and row.utm_source:
        return {
            "utm_source": row.utm_source,
            "utm_medium": row.utm_medium,
            "utm_campaign": row.utm_campaign,
            "utm_term": row.utm_term,
            "utm_content": row.utm_content,
            "anon_id": row.anon_id,
        }

    # 2ª tentativa: qualquer evento com email
    q2 = (
        select(
            TrackingEvento.utm_source,
            TrackingEvento.utm_medium,
            TrackingEvento.utm_campaign,
            TrackingEvento.utm_term,
            TrackingEvento.utm_content,
            TrackingEvento.anon_id,
        )
        .where(
            and_(
                TrackingEvento.created_at >= ini,
                TrackingEvento.created_at <= fim,
                TrackingEvento.metadata_["email"].astext.ilike(email),
                TrackingEvento.utm_source.isnot(None),
            )
        )
        .order_by(TrackingEvento.created_at.desc())
        .limit(1)
    )
    r2 = await db.execute(q2)
    row2 = r2.first()
    if row2 and row2.utm_source:
        return {
            "utm_source": row2.utm_source,
            "utm_medium": row2.utm_medium,
            "utm_campaign": row2.utm_campaign,
            "utm_term": row2.utm_term,
            "utm_content": row2.utm_content,
            "anon_id": row2.anon_id,
        }

    return None
