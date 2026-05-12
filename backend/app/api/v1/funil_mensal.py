"""CRUD de mkt.funil_mensal — funil de mídia paga agregado por mês/frente."""
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.mkt import FunilMensal
from app.models.user import User
from app.schemas.mkt import (
    Frente,
    FunilMensalCreate,
    FunilMensalOut,
    FunilMensalUpdate,
)


router = APIRouter(prefix="/funil-mensal", tags=["marketing-frentes"])


async def buscar_ou_criar(
    db: AsyncSession, frente: str, ano: int, mes: int
) -> FunilMensal:
    """Lazy create: devolve a linha de (frente, ano, mes) ou cria uma vazia."""
    stmt = select(FunilMensal).where(
        FunilMensal.frente == frente,
        FunilMensal.ano == ano,
        FunilMensal.mes == mes,
    )
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()
    if item is not None:
        return item

    item = FunilMensal(frente=frente, ano=ano, mes=mes)
    db.add(item)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        res = await db.execute(stmt)
        item = res.scalar_one()
    await db.refresh(item)
    return item


@router.get("", response_model=list[FunilMensalOut])
async def list_funil_mensal(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    frente: Frente | None = Query(None),
    ano: int | None = Query(None, ge=2020, le=2100),
    mes: int | None = Query(None, ge=1, le=12),
):
    q = select(FunilMensal)
    if frente is not None:
        q = q.where(FunilMensal.frente == frente)
    if ano is not None:
        q = q.where(FunilMensal.ano == ano)
    if mes is not None:
        q = q.where(FunilMensal.mes == mes)
    q = q.order_by(FunilMensal.frente, FunilMensal.ano.desc(), FunilMensal.mes.desc())
    res = await db.execute(q)
    return res.scalars().all()


@router.get("/{frente}/{ano}/{mes}", response_model=FunilMensalOut)
async def get_funil_periodo(
    frente: Frente,
    ano: int,
    mes: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    """Atalho: busca o funil de uma (frente, ano, mes) específica.
    Se não existir, cria vazio (upsert preguiçoso) — a UI nunca lida com 404."""
    return await buscar_ou_criar(db, frente, ano, mes)


@router.post("", response_model=FunilMensalOut, status_code=status.HTTP_201_CREATED)
async def create_funil_mensal(
    body: FunilMensalCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    obj = FunilMensal(**body.model_dump())
    db.add(obj)
    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail=(
                f"Já existe funil para (frente={body.frente}, ano={body.ano}, mes={body.mes})"
            ),
        ) from e
    await db.refresh(obj)
    return obj


@router.patch("/{item_id}", response_model=FunilMensalOut)
async def update_funil_mensal(
    item_id: UUID,
    body: FunilMensalUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    obj = await db.get(FunilMensal, item_id)
    if obj is None:
        raise HTTPException(404, "Funil não encontrado")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    await db.commit()
    await db.refresh(obj)
    return obj
