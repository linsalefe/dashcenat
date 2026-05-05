import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Date,
    DateTime,
    Integer,
    Numeric,
    String,
    Text,
    ForeignKey,
    UniqueConstraint,
    CheckConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, pk_uuid


class MetricaCanal(Base):
    __tablename__ = "metricas_canal"
    __table_args__ = (
        UniqueConstraint("canal_id", "indicador", "produto_id", "ano", "mes", "semana"),
        CheckConstraint("mes BETWEEN 1 AND 12", name="ck_metricas_mes"),
        CheckConstraint("semana BETWEEN 1 AND 5", name="ck_metricas_semana"),
        {"schema": "mkt"},
    )

    id: Mapped[uuid.UUID] = pk_uuid()
    canal_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("core.canais.id"), nullable=False)
    indicador: Mapped[str] = mapped_column(String(100), nullable=False)
    produto_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("core.produtos.id"))
    ano: Mapped[int] = mapped_column(Integer, nullable=False)
    mes: Mapped[int] = mapped_column(Integer, nullable=False)
    semana: Mapped[int | None] = mapped_column(Integer)
    meta: Mapped[Decimal | None] = mapped_column(Numeric(14, 4))
    resultado: Mapped[Decimal | None] = mapped_column(Numeric(14, 4))
    meta_extra: Mapped[dict | None] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    observacao: Mapped[str | None] = mapped_column(Text)
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("core.users.id"))
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class LeadEvento(Base):
    __tablename__ = "leads_eventos"
    __table_args__ = (
        UniqueConstraint("evento_id", "canal_id", "data"),
        {"schema": "mkt"},
    )

    id: Mapped[uuid.UUID] = pk_uuid()
    evento_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("core.eventos.id"), nullable=False)
    canal_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("core.canais.id"), nullable=False)
    data: Mapped[date] = mapped_column(Date, nullable=False)
    inscritos: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    investimento: Mapped[Decimal] = mapped_column(Numeric(12, 2), server_default=text("0"))
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("core.users.id"))
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class InscricaoEvento(Base):
    __tablename__ = "inscricoes_evento"
    __table_args__ = (
        UniqueConstraint("evento_id", "data_registro"),
        {"schema": "mkt"},
    )

    id: Mapped[uuid.UUID] = pk_uuid()
    evento_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("core.eventos.id"), nullable=False)
    data_registro: Mapped[date] = mapped_column(Date, nullable=False)
    inscritos: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    valor_inscricao: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    receita: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("core.users.id"))
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
