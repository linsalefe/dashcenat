import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.catalogo import Produto, Canal, Evento
from app.schemas.catalogo import (
    ProdutoCreate,
    ProdutoUpdate,
    ProdutoOut,
    CanalCreate,
    CanalOut,
    EventoCreate,
    EventoUpdate,
    EventoOut,
)

router = APIRouter()


# --- Produtos ---


@router.get("/produtos", response_model=list[ProdutoOut])
async def list_produtos(
    tipo: str | None = None,
    ativo: bool | None = True,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    q = select(Produto)
    if tipo is not None:
        q = q.where(Produto.tipo == tipo)
    if ativo is not None:
        q = q.where(Produto.ativo == ativo)
    q = q.order_by(Produto.nome)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/produtos", response_model=ProdutoOut, status_code=status.HTTP_201_CREATED)
async def create_produto(
    body: ProdutoCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    produto = Produto(**body.model_dump())
    db.add(produto)
    await db.commit()
    await db.refresh(produto)
    return produto


@router.patch("/produtos/{produto_id}", response_model=ProdutoOut)
async def update_produto(
    produto_id: uuid.UUID,
    body: ProdutoUpdate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    result = await db.execute(select(Produto).where(Produto.id == produto_id))
    produto = result.scalar_one_or_none()
    if produto is None:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(produto, key, value)
    await db.commit()
    await db.refresh(produto)
    return produto


# --- Canais ---


@router.get("/canais", response_model=list[CanalOut])
async def list_canais(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    result = await db.execute(select(Canal).order_by(Canal.nome))
    return result.scalars().all()


@router.post("/canais", response_model=CanalOut, status_code=status.HTTP_201_CREATED)
async def create_canal(
    body: CanalCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    canal = Canal(**body.model_dump())
    db.add(canal)
    await db.commit()
    await db.refresh(canal)
    return canal


# --- Eventos ---


@router.get("/eventos", response_model=list[EventoOut])
async def list_eventos(
    ativo: bool | None = True,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    q = select(Evento)
    if ativo is not None:
        q = q.where(Evento.ativo == ativo)
    q = q.order_by(Evento.nome)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/eventos", response_model=EventoOut, status_code=status.HTTP_201_CREATED)
async def create_evento(
    body: EventoCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    evento = Evento(**body.model_dump())
    db.add(evento)
    await db.commit()
    await db.refresh(evento)
    return evento


@router.patch("/eventos/{evento_id}", response_model=EventoOut)
async def update_evento(
    evento_id: uuid.UUID,
    body: EventoUpdate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    result = await db.execute(select(Evento).where(Evento.id == evento_id))
    evento = result.scalar_one_or_none()
    if evento is None:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(evento, key, value)
    await db.commit()
    await db.refresh(evento)
    return evento
