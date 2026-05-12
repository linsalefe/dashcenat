"""CRUD de mkt.frente_periodo (Sprint Marketing Frentes)."""
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.mkt import FrentePeriodo
from app.models.user import User
from app.schemas.mkt import (
    Frente,
    FrenteDashboardKPI,
    FrenteDashboardOut,
    FrenteFunilEtapa,
    FrentePeriodoCreate,
    FrentePeriodoOut,
    FrentePeriodoUpdate,
)

router = APIRouter(prefix="/frente-periodo", tags=["marketing-frentes"])


@router.get("", response_model=list[FrentePeriodoOut])
async def list_frente_periodo(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    frente: Frente | None = Query(None),
    ano: int | None = Query(None, ge=2020, le=2100),
    mes: int | None = Query(None, ge=1, le=12),
):
    q = select(FrentePeriodo)
    if frente is not None:
        q = q.where(FrentePeriodo.frente == frente)
    if ano is not None:
        q = q.where(FrentePeriodo.ano == ano)
    if mes is not None:
        q = q.where(FrentePeriodo.mes == mes)
    q = q.order_by(
        FrentePeriodo.frente,
        FrentePeriodo.ano.desc(),
        FrentePeriodo.mes.desc(),
        FrentePeriodo.evento_nome,
    )
    result = await db.execute(q)
    return result.scalars().all()


def _pct(num, den) -> Decimal | None:
    """num/den como Decimal(0..1+). None se den é 0/None."""
    if not den:
        return None
    try:
        return (Decimal(str(num)) / Decimal(str(den))).quantize(Decimal("0.0001"))
    except Exception:
        return None


def _soma(eventos: list[FrentePeriodo], attr: str) -> Decimal:
    total = Decimal("0")
    for e in eventos:
        v = getattr(e, attr, None)
        if v is not None:
            total += Decimal(str(v))
    return total


def _dashboard_pos(eventos: list[FrentePeriodo], ano: int, mes: int) -> FrenteDashboardOut:
    leads_meta = _soma(eventos, "meta_leads")
    leads_real = _soma(eventos, "leads")
    lig_meta = _soma(eventos, "meta_ligacao")
    lig_real = _soma(eventos, "ligacao")
    sql_meta = _soma(eventos, "meta_sql")
    sql_real = _soma(eventos, "sql_reuniao")
    reu_meta = _soma(eventos, "meta_reuniao")
    reu_real = _soma(eventos, "reuniao_realizada")
    ven_meta = _soma(eventos, "meta_vendas")
    ven_real = _soma(eventos, "vendas")
    receita = _soma(eventos, "receita")
    meta_receita = _soma(eventos, "meta_receita")
    invest = _soma(eventos, "investimento_ads")

    ticket = (receita / ven_real).quantize(Decimal("0.01")) if ven_real > 0 else None

    funil = [
        FrenteFunilEtapa(nome="Leads", meta=leads_meta, realizado=leads_real,
                         pct_meta=_pct(leads_real, leads_meta)),
        FrenteFunilEtapa(nome="Ligação", meta=lig_meta, realizado=lig_real,
                         pct_meta=_pct(lig_real, lig_meta)),
        FrenteFunilEtapa(nome="SQL", meta=sql_meta, realizado=sql_real,
                         pct_meta=_pct(sql_real, sql_meta)),
        FrenteFunilEtapa(nome="Reunião", meta=reu_meta, realizado=reu_real,
                         pct_meta=_pct(reu_real, reu_meta)),
        FrenteFunilEtapa(nome="Vendas", meta=ven_meta, realizado=ven_real,
                         pct_meta=_pct(ven_real, ven_meta)),
    ]

    kpis = [
        FrenteDashboardKPI(label="Vendas", valor=ven_real, meta=ven_meta,
                           pct_meta=_pct(ven_real, ven_meta), formato="numero"),
        FrenteDashboardKPI(label="Meta Vendas", valor=ven_meta, formato="numero"),
        FrenteDashboardKPI(label="Receita", valor=receita, meta=meta_receita,
                           pct_meta=_pct(receita, meta_receita), formato="moeda"),
        FrenteDashboardKPI(label="Meta Receita", valor=meta_receita, formato="moeda"),
        FrenteDashboardKPI(label="Ticket Médio", valor=(ticket or Decimal("0")), formato="moeda"),
        FrenteDashboardKPI(label="Investimento em Ads", valor=invest, formato="moeda"),
        FrenteDashboardKPI(label="Turmas Ativas", valor=len(eventos), formato="numero"),
        FrenteDashboardKPI(label="Leads Captados", valor=leads_real, meta=leads_meta,
                           pct_meta=_pct(leads_real, leads_meta), formato="numero"),
    ]

    return FrenteDashboardOut(
        frente="pos", ano=ano, mes=mes,
        kpis=kpis, funil=funil,
        eventos=[FrentePeriodoOut.model_validate(e) for e in eventos],
    )


def _dashboard_mkt(frente: Frente, eventos: list[FrentePeriodo], ano: int, mes: int) -> FrenteDashboardOut:
    invest = _soma(eventos, "investimento_ads")
    alcance = _soma(eventos, "alcance")
    cliques = _soma(eventos, "cliques")
    visitas = _soma(eventos, "visitantes_lp")
    checkout = _soma(eventos, "checkout")
    compras = _soma(eventos, "compras")
    meta_insc = _soma(eventos, "meta_inscritos")
    inscritos = _soma(eventos, "inscritos")
    receita = _soma(eventos, "receita")
    meta_receita = _soma(eventos, "meta_receita")

    ticket = (receita / inscritos).quantize(Decimal("0.01")) if inscritos > 0 else None
    cpa = (invest / inscritos).quantize(Decimal("0.01")) if inscritos > 0 else None

    funil = [
        FrenteFunilEtapa(nome="Alcance", realizado=alcance),
        FrenteFunilEtapa(nome="Cliques", realizado=cliques, pct_meta=_pct(cliques, alcance)),
        FrenteFunilEtapa(nome="Visitantes LP", realizado=visitas, pct_meta=_pct(visitas, cliques)),
        FrenteFunilEtapa(nome="Checkout", realizado=checkout, pct_meta=_pct(checkout, visitas)),
        FrenteFunilEtapa(nome="Compras", realizado=compras, pct_meta=_pct(compras, checkout)),
    ]

    kpis = [
        FrenteDashboardKPI(label="Inscritos", valor=inscritos, meta=meta_insc,
                           pct_meta=_pct(inscritos, meta_insc), formato="numero"),
        FrenteDashboardKPI(label="Meta Inscritos", valor=meta_insc, formato="numero"),
        FrenteDashboardKPI(label="Receita", valor=receita, meta=meta_receita,
                           pct_meta=_pct(receita, meta_receita), formato="moeda"),
        FrenteDashboardKPI(label="Meta Receita", valor=meta_receita, formato="moeda"),
        FrenteDashboardKPI(label="Ticket Médio", valor=(ticket or Decimal("0")), formato="moeda"),
        FrenteDashboardKPI(label="Investimento em Ads", valor=invest, formato="moeda"),
        FrenteDashboardKPI(label="CPA", valor=(cpa or Decimal("0")), formato="moeda"),
        FrenteDashboardKPI(label="Eventos Ativos", valor=len(eventos), formato="numero"),
    ]

    return FrenteDashboardOut(
        frente=frente, ano=ano, mes=mes,
        kpis=kpis, funil=funil,
        eventos=[FrentePeriodoOut.model_validate(e) for e in eventos],
    )


@router.get("/dashboard/{frente}", response_model=FrenteDashboardOut)
async def dashboard_frente(
    frente: Frente,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    ano: int = Query(..., ge=2020, le=2100),
    mes: int = Query(..., ge=1, le=12),
):
    q = (
        select(FrentePeriodo)
        .where(FrentePeriodo.frente == frente)
        .where(FrentePeriodo.ano == ano)
        .where(FrentePeriodo.mes == mes)
        .order_by(FrentePeriodo.evento_nome)
    )
    result = await db.execute(q)
    eventos = list(result.scalars().all())

    if frente == "pos":
        return _dashboard_pos(eventos, ano, mes)
    return _dashboard_mkt(frente, eventos, ano, mes)


@router.get("/{item_id}", response_model=FrentePeriodoOut)
async def get_frente_periodo(
    item_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    obj = await db.get(FrentePeriodo, item_id)
    if obj is None:
        raise HTTPException(404, "Registro não encontrado")
    return obj


@router.post("", response_model=FrentePeriodoOut, status_code=status.HTTP_201_CREATED)
async def create_frente_periodo(
    body: FrentePeriodoCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    obj = FrentePeriodo(**body.model_dump())
    db.add(obj)
    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail=(
                f"Já existe registro para (frente={body.frente}, ano={body.ano}, "
                f"mes={body.mes}, evento_nome={body.evento_nome!r})"
            ),
        ) from e
    await db.refresh(obj)
    return obj


@router.patch("/{item_id}", response_model=FrentePeriodoOut)
async def update_frente_periodo(
    item_id: UUID,
    body: FrentePeriodoUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    obj = await db.get(FrentePeriodo, item_id)
    if obj is None:
        raise HTTPException(404, "Registro não encontrado")

    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)

    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_frente_periodo(
    item_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    obj = await db.get(FrentePeriodo, item_id)
    if obj is None:
        raise HTTPException(404, "Registro não encontrado")
    await db.delete(obj)
    await db.commit()
    return None
