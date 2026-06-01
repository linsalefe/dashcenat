"""Rotas Doity — config (token cifrado por evento), sync manual, vendas, análise."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.etl.doity_sync import sync_doity_evento
from app.models.catalogo import Evento
from app.models.mkt import VendaDoity
from app.models.user import User
from app.schemas.doity import (
    DoityAnaliseFacet,
    DoityAnaliseMeta,
    DoityAnaliseOut,
    DoityAnaliseSerie,
    DoityAnaliseTotais,
    DoityConfigIn,
    DoityConfigOut,
    DoityConfigUpdateIn,
    DoitySyncOut,
    VendaDoityOut,
)
from app.services.crypto import decrypt_json, encrypt_json, mask
from app.services.doity import DEFAULT_SITUACOES_PAGAS

router = APIRouter(prefix="/doity", tags=["doity"])
eventos_router = APIRouter(prefix="/eventos", tags=["doity"])


# ============================================================
# Helpers
# ============================================================

async def _get_evento(db: AsyncSession, evento_id: UUID) -> Evento:
    res = await db.execute(select(Evento).where(Evento.id == evento_id))
    evento = res.scalar_one_or_none()
    if evento is None:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    return evento


def _config_out(evento: Evento) -> DoityConfigOut:
    creds = decrypt_json(evento.doity_credentials_cifradas) if evento.doity_credentials_cifradas else {}
    token = creds.get("token") if isinstance(creds, dict) else None
    return DoityConfigOut(
        evento_id=evento.id,
        evento_nome=evento.nome,
        doity_event_id=evento.doity_event_id,
        configurado=bool(evento.doity_event_id and token),
        token_mask=mask(token, show=4) if token else None,
        situacoes_pagas=list(evento.doity_situacoes_pagas or DEFAULT_SITUACOES_PAGAS),
        campo_whatsapp=evento.doity_campo_whatsapp,
        cursor=evento.doity_cursor,
        ultimo_sync=evento.doity_ultimo_sync,
        ultimo_sync_status=evento.doity_ultimo_sync_status,
        ultimo_sync_erro=evento.doity_ultimo_sync_erro,
        ultimo_sync_total=evento.doity_ultimo_sync_total or 0,
    )


# ============================================================
# Config (vive em /eventos/{id}/doity — token e doity_event_id são por evento)
# ============================================================

@eventos_router.get("/{evento_id}/doity", response_model=DoityConfigOut)
async def get_doity_config(
    evento_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    evento = await _get_evento(db, evento_id)
    return _config_out(evento)


@eventos_router.post("/{evento_id}/doity", response_model=DoityConfigOut)
async def post_doity_config(
    evento_id: UUID,
    body: DoityConfigIn,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    evento = await _get_evento(db, evento_id)
    evento.doity_event_id = body.doity_event_id
    evento.doity_credentials_cifradas = encrypt_json({"token": body.token.strip()})
    if body.situacoes_pagas is not None:
        evento.doity_situacoes_pagas = list(body.situacoes_pagas)
    if body.campo_whatsapp is not None:
        evento.doity_campo_whatsapp = body.campo_whatsapp or None
    await db.commit()
    await db.refresh(evento)
    return _config_out(evento)


@eventos_router.patch("/{evento_id}/doity", response_model=DoityConfigOut)
async def patch_doity_config(
    evento_id: UUID,
    body: DoityConfigUpdateIn,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    evento = await _get_evento(db, evento_id)
    if body.doity_event_id is not None:
        evento.doity_event_id = body.doity_event_id
    if body.token:
        evento.doity_credentials_cifradas = encrypt_json({"token": body.token.strip()})
    if body.situacoes_pagas is not None:
        evento.doity_situacoes_pagas = list(body.situacoes_pagas)
    if body.campo_whatsapp is not None:
        evento.doity_campo_whatsapp = body.campo_whatsapp or None
    if body.ativar is not None:
        evento.ativo = body.ativar
    await db.commit()
    await db.refresh(evento)
    return _config_out(evento)


@eventos_router.delete("/{evento_id}/doity", response_model=DoityConfigOut)
async def delete_doity_config(
    evento_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    evento = await _get_evento(db, evento_id)
    evento.doity_event_id = None
    evento.doity_credentials_cifradas = None
    evento.doity_cursor = None
    evento.doity_ultimo_sync_status = None
    evento.doity_ultimo_sync_erro = None
    await db.commit()
    await db.refresh(evento)
    return _config_out(evento)


# ============================================================
# Sync manual
# ============================================================

@eventos_router.post("/{evento_id}/doity/sync", response_model=DoitySyncOut)
async def trigger_sync(
    evento_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    desde: date | None = Query(
        None,
        description="Data inicial pra primeira carga (YYYY-MM-DD, horário BR). Ignorado se já há cursor.",
    ),
):
    evento = await _get_evento(db, evento_id)
    evento_uuid = evento.id
    doity_event_id = evento.doity_event_id
    desde_dt = None
    if desde is not None:
        from datetime import datetime as _dt, timezone as _tz, timedelta as _td
        desde_dt = _dt(desde.year, desde.month, desde.day, tzinfo=_tz(_td(hours=-3))).astimezone(_tz.utc)
    result = await sync_doity_evento(db, evento, desde=desde_dt)
    return DoitySyncOut(
        ok=bool(result.get("ok")),
        evento_id=evento_uuid,
        doity_event_id=doity_event_id,
        total=int(result.get("total") or 0),
        novos=int(result.get("novos") or 0),
        rodadas=int(result.get("rodadas") or 0),
        paginas_lidas=int(result.get("paginas_lidas") or 0),
        cursor=result.get("cursor"),
        erro=result.get("erro") or result.get("motivo"),
    )


# ============================================================
# Vendas
# ============================================================

@router.get("/vendas", response_model=list[VendaDoityOut])
async def list_vendas(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    evento_id: UUID = Query(...),
    pago: bool | None = None,
    em_contestacao: bool | None = None,
    data_inicio: date | None = None,
    data_fim: date | None = None,
    limit: int = Query(500, le=2000),
    offset: int = Query(0, ge=0),
):
    filtros = [VendaDoity.evento_id == evento_id]
    if pago is not None:
        filtros.append(VendaDoity.pago.is_(pago))
    if em_contestacao is not None:
        filtros.append(VendaDoity.em_contestacao.is_(em_contestacao))
    if data_inicio is not None:
        filtros.append(VendaDoity.data_inscricao >= data_inicio)
    if data_fim is not None:
        filtros.append(VendaDoity.data_inscricao <= data_fim)
    q = (
        select(VendaDoity)
        .where(and_(*filtros))
        .order_by(VendaDoity.data_inscricao.desc().nulls_last(), VendaDoity.criado_em.desc())
        .limit(limit)
        .offset(offset)
    )
    res = await db.execute(q)
    return list(res.scalars().all())


# ============================================================
# Análise agregada
# ============================================================

@router.get("/analise/{evento_id}", response_model=DoityAnaliseOut)
async def get_analise(
    evento_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    top_n: int = Query(15, ge=1, le=100),
):
    evento = await _get_evento(db, evento_id)

    where_base = VendaDoity.evento_id == evento_id

    # ----- Totais -----
    q_tot = select(
        func.count().label("inscricoes"),
        func.count().filter(VendaDoity.pago.is_(True)).label("pagas"),
        func.count().filter(VendaDoity.em_contestacao.is_(True)).label("em_contestacao"),
        func.count().filter(VendaDoity.situacao_codigo == 9).label("gratuitas"),
        func.coalesce(
            func.sum(VendaDoity.valor_recebido).filter(VendaDoity.pago.is_(True)),
            0,
        ).label("receita"),
    ).where(where_base)
    r_tot = (await db.execute(q_tot)).one()

    receita = Decimal(r_tot.receita or 0)
    pagas = r_tot.pagas or 0
    ticket_medio = (receita / pagas) if pagas else None

    totais = DoityAnaliseTotais(
        inscricoes=r_tot.inscricoes or 0,
        pagas=pagas,
        em_contestacao=r_tot.em_contestacao or 0,
        gratuitas=r_tot.gratuitas or 0,
        receita=receita,
        ticket_medio=ticket_medio,
    )

    # ----- Série diária por data_inscricao -----
    dia = VendaDoity.data_inscricao
    q_dia = (
        select(
            dia.label("d"),
            func.count().label("inscricoes"),
            func.count().filter(VendaDoity.pago.is_(True)).label("pagas"),
            func.coalesce(
                func.sum(VendaDoity.valor_recebido).filter(VendaDoity.pago.is_(True)),
                0,
            ).label("receita"),
        )
        .where(and_(where_base, dia.is_not(None)))
        .group_by(dia)
        .order_by(dia)
    )
    r_dia = await db.execute(q_dia)
    serie = [
        DoityAnaliseSerie(
            data=row.d,
            inscricoes=row.inscricoes or 0,
            pagas=row.pagas or 0,
            receita=Decimal(row.receita or 0),
        )
        for row in r_dia.all()
    ]

    # ----- Facetas demográficas -----
    async def _facet(coluna) -> list[DoityAnaliseFacet]:
        q = (
            select(
                coluna.label("chave"),
                func.count().label("inscricoes"),
                func.count().filter(VendaDoity.pago.is_(True)).label("pagas"),
            )
            .where(and_(where_base, coluna.is_not(None), coluna != ""))
            .group_by(coluna)
            .order_by(func.count().desc())
            .limit(top_n)
        )
        r = await db.execute(q)
        return [
            DoityAnaliseFacet(
                chave=str(row.chave), inscricoes=row.inscricoes or 0, pagas=row.pagas or 0
            )
            for row in r.all()
        ]

    por_estado = await _facet(VendaDoity.estado)
    por_cidade = await _facet(VendaDoity.cidade)
    por_profissao = await _facet(VendaDoity.profissao)
    por_genero = await _facet(VendaDoity.genero)

    # ----- Meta vs realizado -----
    meta_inscritos = evento.meta_inscritos
    meta_receita = evento.meta_receita
    pct_inscritos = (
        float(totais.inscricoes) / float(meta_inscritos) * 100.0
        if meta_inscritos
        else None
    )
    pct_receita = (
        float(receita) / float(meta_receita) * 100.0
        if meta_receita and float(meta_receita) > 0
        else None
    )

    return DoityAnaliseOut(
        evento_id=evento.id,
        evento_nome=evento.nome,
        totais=totais,
        serie_diaria=serie,
        por_estado=por_estado,
        por_cidade=por_cidade,
        por_profissao=por_profissao,
        por_genero=por_genero,
        meta=DoityAnaliseMeta(
            meta_inscritos=meta_inscritos,
            meta_receita=meta_receita,
            pct_inscritos=pct_inscritos,
            pct_receita=pct_receita,
        ),
    )


# Re-export pra registro no main.py
__all__ = ["router", "eventos_router"]
