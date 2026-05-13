"""Modelo de integrações externas (Hotmart, Meta, Exact Sales)."""
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, pk_uuid


class Integracao(Base):
    """
    Tabela genérica de configuração de integrações externas.
    Credenciais ficam cifradas (Fernet) em `credentials_cifradas` como JSON.
    """
    __tablename__ = "integracoes"
    __table_args__ = (
        CheckConstraint(
            "servico IN ('hotmart','meta_ads','meta_instagram','meta_whatsapp','exact_sales')",
            name="ck_integracoes_servico",
        ),
        {"schema": "core"},
    )

    id: Mapped[uuid.UUID] = pk_uuid()
    servico: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    ativo: Mapped[bool] = mapped_column(Boolean, server_default=text("true"), nullable=False)
    credentials_cifradas: Mapped[str | None] = mapped_column(Text)
    config_extra: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )
    ultimo_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ultimo_sync_status: Mapped[str | None] = mapped_column(String(50))
    ultimo_sync_erro: Mapped[str | None] = mapped_column(Text)
    ultimo_sync_total: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
