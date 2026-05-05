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
    Text,
    ForeignKey,
    UniqueConstraint,
    CheckConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, pk_uuid


class FunilEtapa(Base):
    __tablename__ = "funil_etapas"
    __table_args__ = {"schema": "comercial"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    codigo: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    nome: Mapped[str] = mapped_column(String(100), nullable=False)
    ordem: Mapped[int] = mapped_column(Integer, nullable=False)


class FunilResultado(Base):
    __tablename__ = "funil_resultado"
    __table_args__ = (
        UniqueConstraint("produto_id", "etapa_id", "ano", "mes"),
        CheckConstraint("mes BETWEEN 1 AND 12", name="ck_funil_mes"),
        {"schema": "comercial"},
    )

    id: Mapped[uuid.UUID] = pk_uuid()
    produto_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("core.produtos.id"), nullable=False
    )
    etapa_id: Mapped[int] = mapped_column(
        ForeignKey("comercial.funil_etapas.id"), nullable=False
    )
    ano: Mapped[int] = mapped_column(Integer, nullable=False)
    mes: Mapped[int] = mapped_column(Integer, nullable=False)
    meta: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    resultado: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    observacao: Mapped[str | None] = mapped_column(Text)
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("core.users.id"))
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class Venda(Base):
    __tablename__ = "vendas"
    __table_args__ = {"schema": "comercial"}

    id: Mapped[uuid.UUID] = pk_uuid()
    produto_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("core.produtos.id"), nullable=False
    )
    aluno_nome: Mapped[str] = mapped_column(String(255), nullable=False)
    aluno_email: Mapped[str | None] = mapped_column(String(255))
    data_venda: Mapped[date] = mapped_column(Date, nullable=False)
    valor: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    prazo_recebimento_meses: Mapped[int | None] = mapped_column(Integer)
    a_vista: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    vendedor: Mapped[str | None] = mapped_column(String(100))
    observacao: Mapped[str | None] = mapped_column(Text)
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("core.users.id"))
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class Reuniao(Base):
    __tablename__ = "reunioes"
    __table_args__ = {"schema": "comercial"}

    id: Mapped[uuid.UUID] = pk_uuid()
    produto_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("core.produtos.id"), nullable=False
    )
    aluno_nome: Mapped[str | None] = mapped_column(String(255))
    aluno_email: Mapped[str | None] = mapped_column(String(255))
    vendedor: Mapped[str | None] = mapped_column(String(100))
    data_agendada: Mapped[date] = mapped_column(Date, nullable=False)
    data_realizada: Mapped[date | None] = mapped_column(Date)
    no_show: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    resultou_em_venda: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    observacao: Mapped[str | None] = mapped_column(Text)
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("core.users.id"))
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


# ============================================================
# Sprint APR1 — comercial.intercambio
# ============================================================

class Intercambio(Base):
    __tablename__ = "intercambio"
    __table_args__ = ({"schema": "comercial"},)

    id: Mapped[uuid.UUID] = pk_uuid()
    nome_aluno: Mapped[str] = mapped_column(String(300), nullable=False)
    valor: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    data_venda: Mapped[date] = mapped_column(Date, nullable=False)
    observacao: Mapped[str | None] = mapped_column(Text)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
