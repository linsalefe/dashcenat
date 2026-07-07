"""Modelos do módulo Gerência (schema `gerencia`) — integração monday.com.

Zero-config: o catálogo `gerencia.boards` é populado pela descoberta automática
(app.etl.monday_discovery), não à mão. Para cada board detectam-se automaticamente
as colunas de status/prazo/responsável (`colunas_map`) e a categorização dos rótulos
de status (`status_map`). Correções manuais raras ficam em `overrides` — o mapa
efetivo usado pelo sync é `auto ⊕ overrides`, e a re-descoberta NUNCA sobrescreve
`overrides` nem `incluido`.

Convenções (CLAUDE.md): colunas em português, PK UUID via gen_random_uuid(),
TIMESTAMPTZ sempre UTC, schema declarado em __table_args__.
"""
import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, pk_uuid


class Board(Base):
    """Um board de projeto do monday, descoberto automaticamente.

    Mapa efetivo = colunas_map/status_map (auto) sobrescrito por overrides (manual).
    `incluido` é o toggle que liga/silencia o board no sync (default: true se é
    projeto — tem coluna de status — e está no escopo padrão).
    """

    __tablename__ = "boards"
    __table_args__ = (
        UniqueConstraint("monday_board_id", name="uq_gerencia_board_monday_id"),
        {"schema": "gerencia"},
    )

    id: Mapped[uuid.UUID] = pk_uuid()
    monday_board_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    nome: Mapped[str] = mapped_column(String(512), nullable=False)
    workspace: Mapped[str | None] = mapped_column(String(255))
    board_kind: Mapped[str | None] = mapped_column(String(50))

    # Detecção automática (re-descoberta atualiza estes)
    colunas_map: Mapped[dict[str, Any]] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )
    status_map: Mapped[dict[str, Any]] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )
    # Correções manuais (re-descoberta NÃO sobrescreve). Mapa efetivo = auto ⊕ overrides.
    overrides: Mapped[dict[str, Any]] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )

    incluido: Mapped[bool] = mapped_column(
        Boolean, server_default=text("false"), nullable=False
    )
    confianca_classificacao: Mapped[str | None] = mapped_column(String(30))
    ativo: Mapped[bool] = mapped_column(
        Boolean, server_default=text("true"), nullable=False
    )

    # Espelha core.integracoes
    ultimo_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ultimo_sync_status: Mapped[str | None] = mapped_column(String(50))
    ultimo_sync_erro: Mapped[str | None] = mapped_column(Text)
    ultimo_sync_total: Mapped[int] = mapped_column(
        Integer, server_default=text("0"), nullable=False
    )

    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )


class Item(Base):
    """Um item (task) dentro de um board, normalizado pelo mapa efetivo do board."""

    __tablename__ = "itens"
    __table_args__ = (
        UniqueConstraint("board_id", "monday_item_id", name="uq_gerencia_item"),
        {"schema": "gerencia"},
    )

    id: Mapped[uuid.UUID] = pk_uuid()
    board_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("gerencia.boards.id", ondelete="CASCADE"), nullable=False
    )
    monday_item_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    nome: Mapped[str | None] = mapped_column(Text)
    grupo: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str | None] = mapped_column(String(255))
    # Lista de {"person_id": int, "nome": str} — agregação é sempre por person_id.
    responsaveis: Mapped[list[Any]] = mapped_column(
        JSONB, server_default=text("'[]'::jsonb"), nullable=False
    )
    prazo_inicio: Mapped[date | None] = mapped_column(Date)
    prazo_fim: Mapped[date | None] = mapped_column(Date)
    concluido: Mapped[bool] = mapped_column(
        Boolean, server_default=text("false"), nullable=False
    )
    atrasado: Mapped[bool] = mapped_column(
        Boolean, server_default=text("false"), nullable=False
    )
    criado_monday: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    atualizado_monday: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    raw: Mapped[dict[str, Any]] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )
    sincronizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )


class SnapshotDiario(Base):
    """Foto diária dos KPIs de um board (1 linha/board/dia) — base da tendência."""

    __tablename__ = "snapshots_diarios"
    __table_args__ = (
        UniqueConstraint("board_id", "data", name="uq_gerencia_snapshot"),
        {"schema": "gerencia"},
    )

    id: Mapped[uuid.UUID] = pk_uuid()
    board_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("gerencia.boards.id", ondelete="CASCADE"), nullable=False
    )
    data: Mapped[date] = mapped_column(Date, nullable=False)
    total: Mapped[int] = mapped_column(Integer, server_default=text("0"), nullable=False)
    em_andamento: Mapped[int] = mapped_column(Integer, server_default=text("0"), nullable=False)
    atrasadas: Mapped[int] = mapped_column(Integer, server_default=text("0"), nullable=False)
    concluidas: Mapped[int] = mapped_column(Integer, server_default=text("0"), nullable=False)
    sem_responsavel: Mapped[int] = mapped_column(Integer, server_default=text("0"), nullable=False)
    sem_prazo: Mapped[int] = mapped_column(Integer, server_default=text("0"), nullable=False)
    metricas: Mapped[dict[str, Any]] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )
