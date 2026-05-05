import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Integer,
    Numeric,
    String,
    ForeignKey,
    text,
)
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, pk_uuid

tipo_produto_enum = ENUM(
    "pos_graduacao",
    "curso_livre",
    "congresso_online",
    "congresso_presencial",
    "comunidade",
    "seminario_online",
    "evento_online",
    name="tipo_produto",
    schema="core",
    create_type=True,
)


class Produto(Base):
    __tablename__ = "produtos"
    __table_args__ = {"schema": "core"}

    id: Mapped[uuid.UUID] = pk_uuid()
    tipo: Mapped[str] = mapped_column(tipo_produto_enum, nullable=False)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    turma: Mapped[str | None] = mapped_column(String(50))
    codigo: Mapped[str | None] = mapped_column(String(50), unique=True)
    ativo: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class Canal(Base):
    __tablename__ = "canais"
    __table_args__ = {"schema": "core"}

    id: Mapped[uuid.UUID] = pk_uuid()
    nome: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    categoria: Mapped[str | None] = mapped_column(String(50))
    ativo: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))


class Evento(Base):
    __tablename__ = "eventos"
    __table_args__ = {"schema": "core"}

    id: Mapped[uuid.UUID] = pk_uuid()
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    produto_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("core.produtos.id")
    )
    meta_inscritos: Mapped[int | None] = mapped_column(Integer)
    meta_receita: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    valor_inscricao: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    data_final: Mapped[date | None] = mapped_column(Date)
    data_finalizacao: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    meta_cpl: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    orcamento: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    ativo: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
