"""CRUD de tracking.utm_links — gerador de UTM e short-links."""
import secrets
import string
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.tracking import UtmLink
from app.models.user import User
from app.schemas.tracking import UtmLinkCreate, UtmLinkOut

router = APIRouter(prefix="/utm/links", tags=["utm"])

ALPHABET = string.ascii_lowercase + string.digits


def gen_slug(n: int = 7) -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(n))


@router.get("", response_model=list[UtmLinkOut])
async def list_links(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    q: str | None = Query(None, description="Busca por nome ou campanha"),
):
    qry = select(UtmLink).order_by(UtmLink.criado_em.desc())
    if q:
        like = f"%{q}%"
        qry = qry.where((UtmLink.nome.ilike(like)) | (UtmLink.utm_campaign.ilike(like)))
    res = await db.execute(qry)
    return res.scalars().all()


@router.post("", response_model=UtmLinkOut, status_code=201)
async def create_link(
    body: UtmLinkCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    # gera slug único (até 5 tentativas)
    for _ in range(5):
        slug = gen_slug()
        exists = await db.execute(select(UtmLink).where(UtmLink.slug == slug))
        if not exists.scalar_one_or_none():
            break
    else:
        raise HTTPException(500, "Falha ao gerar slug único")

    obj = UtmLink(
        slug=slug,
        usuario_id=user.id,
        **body.model_dump(),
    )
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{link_id}", status_code=204)
async def delete_link(
    link_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    obj = await db.get(UtmLink, link_id)
    if not obj:
        raise HTTPException(404, "Link não encontrado")
    await db.delete(obj)
    await db.commit()
    return None
