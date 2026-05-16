"""Rotas Hotmart — config (autenticada), sync (autenticada), webhook (público), stats."""
from datetime import datetime
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.etl.hotmart_sync import sync_hotmart, _upsert_venda
from app.models.integracoes import Integracao
from app.models.mkt import VendaHotmart
from app.models.user import User
from app.schemas.hotmart import (
    HotmartConfigIn,
    HotmartConfigOut,
    HotmartStats,
    SyncRequest,
    SyncResult,
    VendaHotmartOut,
)
from app.services.crypto import decrypt_json, encrypt_json, mask
from app.services.hotmart import HotmartError, parse_sale, validar_webhook

router = APIRouter(prefix="/hotmart", tags=["hotmart"])

# Status considerados "faturamento confirmado" no dashboard (KPIs e listagem).
# REFUNDED fica fora pra não inflar a receita.
STATUS_DASHBOARD = ("APPROVED", "COMPLETE")


def _mes_range(ano: int, mes: int) -> tuple[datetime, datetime]:
    """Retorna [primeiro_dia_do_mes, primeiro_dia_do_mes_seguinte) — semiaberto."""
    inicio = datetime(ano, mes, 1)
    if mes == 12:
        fim = datetime(ano + 1, 1, 1)
    else:
        fim = datetime(ano, mes + 1, 1)
    return inicio, fim


def _segmento_filter(segmento: str):
    """Retorna lista de expressões SQLAlchemy pra aplicar no where().

    - 'todos': sem filtro adicional
    - 'comunidade': is_subscription = TRUE
    - 'cursos': is_subscription IS DISTINCT FROM TRUE (inclui FALSE e NULL)
    """
    if segmento == "comunidade":
        return [VendaHotmart.is_subscription.is_(True)]
    if segmento == "cursos":
        return [VendaHotmart.is_subscription.is_not(True)]
    return []


# ============================================================
# Config
# ============================================================

@router.get("/config", response_model=HotmartConfigOut)
async def get_config(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    res = await db.execute(select(Integracao).where(Integracao.servico == "hotmart"))
    integ = res.scalar_one_or_none()
    if not integ:
        return HotmartConfigOut(
            configurado=False, ativo=False,
            client_id_mask=None, has_secret=False, has_basic_token=False, has_hottok=False,
            ultimo_sync=None, ultimo_sync_status=None, ultimo_sync_erro=None, ultimo_sync_total=0,
        )
    creds = decrypt_json(integ.credentials_cifradas)
    cid = creds.get("client_id")
    return HotmartConfigOut(
        configurado=bool(cid and creds.get("client_secret")),
        ativo=integ.ativo,
        client_id_mask=mask(cid, show=4) if cid else None,
        has_secret=bool(creds.get("client_secret")),
        has_basic_token=bool(creds.get("basic_token")),
        has_hottok=bool(creds.get("hottok")),
        ultimo_sync=integ.ultimo_sync,
        ultimo_sync_status=integ.ultimo_sync_status,
        ultimo_sync_erro=integ.ultimo_sync_erro,
        ultimo_sync_total=integ.ultimo_sync_total or 0,
    )


@router.put("/config", response_model=HotmartConfigOut)
async def put_config(
    body: HotmartConfigIn,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    res = await db.execute(select(Integracao).where(Integracao.servico == "hotmart"))
    integ = res.scalar_one_or_none()
    creds = decrypt_json(integ.credentials_cifradas) if integ else {}

    # merge (campos não enviados permanecem)
    for campo in ("client_id", "client_secret", "basic_token", "hottok"):
        v = getattr(body, campo)
        if v is not None and v != "":
            creds[campo] = v.strip()

    cifrado = encrypt_json(creds) if creds else None
    ativo = body.ativo if body.ativo is not None else (integ.ativo if integ else True)

    if integ:
        integ.credentials_cifradas = cifrado
        integ.ativo = ativo
    else:
        integ = Integracao(servico="hotmart", credentials_cifradas=cifrado, ativo=ativo)
        db.add(integ)

    await db.commit()
    await db.refresh(integ)
    return await get_config(db, user)


# ============================================================
# Sync manual
# ============================================================

@router.post("/sync", response_model=SyncResult)
async def trigger_sync(
    body: SyncRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    try:
        result = await sync_hotmart(
            db,
            start_date=body.start_date,
            end_date=body.end_date,
            transaction_status=body.transaction_status,  # None → default multi-status
        )
        return SyncResult(**result)
    except HotmartError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================
# Webhook (público, valida hottok)
# ============================================================

@router.post("/webhook", include_in_schema=False)
async def hotmart_webhook(
    request: Request,
    background: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    body = await request.json()

    res = await db.execute(select(Integracao).where(Integracao.servico == "hotmart"))
    integ = res.scalar_one_or_none()
    if not integ:
        raise HTTPException(404, "Hotmart não configurado")
    creds = decrypt_json(integ.credentials_cifradas)
    expected = creds.get("hottok")

    # hottok pode vir no header ou no body
    header_hottok = request.headers.get("x-hotmart-hottok") or body.get("hottok")
    if not validar_webhook(header_hottok, expected):
        raise HTTPException(401, "hottok inválido")

    event = body.get("event") or ""
    data = body.get("data") or {}

    # Processa em background pra responder rápido pro Hotmart
    background.add_task(_process_webhook, event, data)
    return {"ok": True, "event": event}


async def _process_webhook(event: str, data: dict):
    """Insere/atualiza venda do webhook. Roda em background com sessão própria."""
    from app.core.db import async_session
    if not event.startswith("PURCHASE"):
        return
    async with async_session() as db:
        try:
            parsed = parse_sale(data)
            if not parsed.get("transacao"):
                return
            await _upsert_venda(db, parsed)
            await db.commit()
        except Exception:
            await db.rollback()
            raise


# ============================================================
# Listar vendas
# ============================================================

@router.get("/vendas", response_model=list[VendaHotmartOut])
async def list_vendas(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    ano: int = Query(..., ge=2020, le=2100),
    mes: int = Query(..., ge=1, le=12),
    segmento: str = Query("todos", pattern="^(todos|cursos|comunidade)$"),
    produto: str | None = None,
    limit: int = Query(500, le=2000),
):
    inicio, fim = _mes_range(ano, mes)
    filtros = [
        VendaHotmart.data_venda >= inicio,
        VendaHotmart.data_venda < fim,
        VendaHotmart.status.in_(STATUS_DASHBOARD),
        *_segmento_filter(segmento),
    ]
    if produto:
        filtros.append(VendaHotmart.produto.ilike(f"%{produto}%"))

    q = (
        select(VendaHotmart)
        .where(and_(*filtros))
        .order_by(VendaHotmart.data_venda.desc().nulls_last())
        .limit(limit)
    )
    res = await db.execute(q)
    return res.scalars().all()


# ============================================================
# Stats
# ============================================================

@router.get("/stats", response_model=HotmartStats)
async def get_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    ano: int = Query(..., ge=2020, le=2100),
    mes: int = Query(..., ge=1, le=12),
    segmento: str = Query("todos", pattern="^(todos|cursos|comunidade)$"),
):
    inicio, fim = _mes_range(ano, mes)
    where = and_(
        VendaHotmart.data_venda >= inicio,
        VendaHotmart.data_venda < fim,
        VendaHotmart.status.in_(STATUS_DASHBOARD),
        *_segmento_filter(segmento),
    )

    # Totais
    q_tot = select(
        func.coalesce(func.sum(VendaHotmart.faturamento_liquido), 0).label("receita"),
        func.count().label("count"),
        func.count().filter(VendaHotmart.utm_source.isnot(None)).label("matched"),
    ).where(where)
    r = (await db.execute(q_tot)).one()
    receita = Decimal(r.receita or 0)
    count = r.count or 0
    matched = r.matched or 0
    ticket = (receita / count) if count else Decimal(0)
    matched_pct = (matched / count * 100) if count else 0.0

    # Receita por dia
    dia = func.date_trunc("day", VendaHotmart.data_venda)
    q_dia = (
        select(
            dia.label("d"),
            func.coalesce(func.sum(VendaHotmart.faturamento_liquido), 0).label("receita"),
            func.count().label("vendas"),
        )
        .where(where)
        .group_by(dia)
        .order_by(dia)
    )
    r_dia = await db.execute(q_dia)
    receita_por_dia = [
        {
            "data": (x.d.date().isoformat() if isinstance(x.d, datetime) else str(x.d)),
            "receita": float(x.receita or 0),
            "vendas": x.vendas or 0,
        }
        for x in r_dia.all()
    ]

    # Top produtos
    q_prod = (
        select(
            VendaHotmart.produto,
            func.count().label("vendas"),
            func.coalesce(func.sum(VendaHotmart.faturamento_liquido), 0).label("receita"),
        )
        .where(where)
        .group_by(VendaHotmart.produto)
        .order_by(func.sum(VendaHotmart.faturamento_liquido).desc().nulls_last())
        .limit(10)
    )
    r_prod = await db.execute(q_prod)
    top_produtos = [
        {"produto": x.produto, "vendas": x.vendas or 0, "receita": float(x.receita or 0)}
        for x in r_prod.all()
    ]

    # Top campaigns
    q_cmp = (
        select(
            func.coalesce(VendaHotmart.utm_campaign, "(sem campanha)").label("c"),
            func.count().label("vendas"),
            func.coalesce(func.sum(VendaHotmart.faturamento_liquido), 0).label("receita"),
        )
        .where(where)
        .group_by(VendaHotmart.utm_campaign)
        .order_by(func.sum(VendaHotmart.faturamento_liquido).desc().nulls_last())
        .limit(10)
    )
    r_cmp = await db.execute(q_cmp)
    top_campaigns = [
        {"campaign": x.c, "vendas": x.vendas or 0, "receita": float(x.receita or 0)}
        for x in r_cmp.all()
    ]

    # Top CTAs (qual botão da LP originou a venda)
    q_cta = (
        select(
            VendaHotmart.cta,
            func.count().label("vendas"),
            func.coalesce(func.sum(VendaHotmart.faturamento_liquido), 0).label("receita"),
        )
        .where(where)
        .where(VendaHotmart.cta.isnot(None))
        .group_by(VendaHotmart.cta)
        .order_by(func.sum(VendaHotmart.faturamento_liquido).desc().nulls_last())
        .limit(10)
    )
    r_cta = await db.execute(q_cta)
    top_ctas = [
        {"cta": x.cta, "vendas": x.vendas or 0, "receita": float(x.receita or 0)}
        for x in r_cta.all()
    ]

    return HotmartStats(
        receita_total=receita,
        vendas_count=count,
        ticket_medio=ticket,
        matched_pct=round(matched_pct, 1),
        receita_por_dia=receita_por_dia,
        top_produtos=top_produtos,
        top_campaigns=top_campaigns,
        top_ctas=top_ctas,
    )
