"""Modelos do schema tracking — UTM links e eventos (pageview/click/conversion)."""
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, pk_uuid


class UtmLink(Base):
    __tablename__ = "utm_links"
    __table_args__ = {"schema": "tracking"}

    id: Mapped[uuid.UUID] = pk_uuid()
    slug: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    url_destino: Mapped[str] = mapped_column(Text, nullable=False)
    utm_source: Mapped[str] = mapped_column(String(100), nullable=False)
    utm_medium: Mapped[str] = mapped_column(String(100), nullable=False)
    utm_campaign: Mapped[str] = mapped_column(String(150), nullable=False)
    utm_term: Mapped[str | None] = mapped_column(String(150))
    utm_content: Mapped[str | None] = mapped_column(String(150))
    produto_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("core.produtos.id"))
    produto_nome: Mapped[str | None] = mapped_column(String(255))
    canal_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("core.canais.id"))
    short_link: Mapped[bool] = mapped_column(Boolean, server_default=text("true"), nullable=False)
    clicks: Mapped[int] = mapped_column(Integer, server_default=text("0"), nullable=False)
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("core.users.id"))
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )


class TrackingEvento(Base):
    __tablename__ = "eventos"
    __table_args__ = (
        CheckConstraint("tipo IN ('pageview','click','conversion')", name="ck_eventos_tipo"),
        {"schema": "tracking"},
    )

    id: Mapped[uuid.UUID] = pk_uuid()
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)
    site: Mapped[str | None] = mapped_column(String(100))
    anon_id: Mapped[str | None] = mapped_column(String(64))
    session_id: Mapped[str | None] = mapped_column(String(64))
    url: Mapped[str | None] = mapped_column(Text)
    path: Mapped[str | None] = mapped_column(String(500))
    referrer: Mapped[str | None] = mapped_column(Text)
    utm_source: Mapped[str | None] = mapped_column(String(100))
    utm_medium: Mapped[str | None] = mapped_column(String(100))
    utm_campaign: Mapped[str | None] = mapped_column(String(150))
    utm_term: Mapped[str | None] = mapped_column(String(150))
    utm_content: Mapped[str | None] = mapped_column(String(150))
    utm_link_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tracking.utm_links.id"))
    produto_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("core.produtos.id"))
    produto_nome: Mapped[str | None] = mapped_column(String(255))
    evento_nome: Mapped[str | None] = mapped_column(String(150))
    valor: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    metadata_: Mapped[dict] = mapped_column(
        "metadata", JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )
    ip: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
