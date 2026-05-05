"""CRUD de comercial.intercambio (Sprint APR1)."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, extract, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.comercial import Intercambio
from app.models.user import User
from app.schemas.comercial import IntercambioCreate, IntercambioOut, IntercambioUpdate

router = APIRouter(prefix="/intercambio", tags=["intercambio"])


@router.get("", response_model=list[IntercambioOut])
async def list_intercambio(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    ano: int | None = Query(None),
    mes: int | None = Query(None),
):
    q = select(Intercambio).order_by(Intercambio.data_venda.desc())
    filters = []
    if ano:
        filters.append(extract("year", Intercambio.data_venda) == ano)
    if mes:
        filters.append(extract("month", Intercambio.data_venda) == mes)
    if filters:
        q = q.where(and_(*filters))

    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=IntercambioOut, status_code=201)
async def create_intercambio(
    body: IntercambioCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    obj = Intercambio(**body.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/{intercambio_id}", response_model=IntercambioOut)
async def update_intercambio(
    intercambio_id: UUID,
    body: IntercambioUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    obj = await db.get(Intercambio, intercambio_id)
    if not obj:
        raise HTTPException(404, "Registro não encontrado")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{intercambio_id}", status_code=204)
async def delete_intercambio(
    intercambio_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    obj = await db.get(Intercambio, intercambio_id)
    if not obj:
        raise HTTPException(404, "Registro não encontrado")
    await db.delete(obj)
    await db.commit()
    return None
