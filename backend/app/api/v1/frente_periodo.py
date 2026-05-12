"""CRUD de mkt.frente_periodo (Sprint Marketing Frentes)."""
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
