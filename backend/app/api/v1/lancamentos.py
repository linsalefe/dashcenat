"""CRUD de mkt.lancamentos (Sprint APR1)."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.mkt import Lancamento
from app.models.user import User
from app.schemas.mkt import LancamentoCreate, LancamentoOut, LancamentoUpdate

router = APIRouter(prefix="/lancamentos", tags=["lancamentos"])


@router.get("", response_model=list[LancamentoOut])
async def list_lancamentos(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    ano: int | None = Query(None),
):
    q = select(Lancamento).order_by(Lancamento.ano.desc(), Lancamento.mes.desc())
    if ano:
        q = q.where(Lancamento.ano == ano)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=LancamentoOut, status_code=201)
async def create_lancamento(
    body: LancamentoCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    existing = await db.execute(select(Lancamento).where(and_(
        Lancamento.ano == body.ano,
        Lancamento.mes == body.mes,
        Lancamento.nome == body.nome,
    )))
    if existing.scalar_one_or_none():
        raise HTTPException(409, f"Lançamento '{body.nome}' já existe em {body.ano}-{body.mes:02d}")

    obj = Lancamento(**body.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/{lancamento_id}", response_model=LancamentoOut)
async def update_lancamento(
    lancamento_id: UUID,
    body: LancamentoUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    obj = await db.get(Lancamento, lancamento_id)
    if not obj:
        raise HTTPException(404, "Lançamento não encontrado")

    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)

    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{lancamento_id}", status_code=204)
async def delete_lancamento(
    lancamento_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    obj = await db.get(Lancamento, lancamento_id)
    if not obj:
        raise HTTPException(404, "Lançamento não encontrado")
    await db.delete(obj)
    await db.commit()
    return None
