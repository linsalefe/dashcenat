"""gerencia monday schema: schema gerencia + boards/itens/snapshots + 'monday' em integracoes

- Cria o schema `gerencia` e as 3 tabelas do catálogo auto-populado
  (boards descobertos, itens sincronizados, snapshots diários da tendência).
- Adiciona 'monday' ao CheckConstraint de core.integracoes.servico (drop + recria),
  para guardar o token cifrado do monday.

Nada é seedado — o catálogo `gerencia.boards` é populado pela descoberta automática
(app.etl.monday_discovery), não por migration.

Revision ID: m4a7b1c9e3f2
Revises: l9d2a7c4f3e1
Create Date: 2026-07-07 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = "m4a7b1c9e3f2"
down_revision: Union[str, None] = "l9d2a7c4f3e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Valores atuais do CHECK de core.integracoes.servico (sem/com 'monday').
_SERVICOS_ANTES = "'hotmart','meta_ads','meta_instagram','meta_whatsapp','exact_sales'"
_SERVICOS_DEPOIS = _SERVICOS_ANTES + ",'monday'"


def upgrade() -> None:
    # ---- schema ----
    op.execute("CREATE SCHEMA IF NOT EXISTS gerencia")

    # ---- 'monday' no CHECK de core.integracoes ----
    op.execute("ALTER TABLE core.integracoes DROP CONSTRAINT IF EXISTS ck_integracoes_servico")
    op.execute(
        f"ALTER TABLE core.integracoes ADD CONSTRAINT ck_integracoes_servico "
        f"CHECK (servico IN ({_SERVICOS_DEPOIS}))"
    )

    # ---- gerencia.boards (catálogo auto-populado) ----
    op.execute(
        """
        CREATE TABLE gerencia.boards (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          monday_board_id BIGINT NOT NULL,
          nome VARCHAR(512) NOT NULL,
          workspace VARCHAR(255),
          board_kind VARCHAR(50),
          colunas_map JSONB NOT NULL DEFAULT '{}'::jsonb,
          status_map JSONB NOT NULL DEFAULT '{}'::jsonb,
          overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
          incluido BOOLEAN NOT NULL DEFAULT false,
          confianca_classificacao VARCHAR(30),
          ativo BOOLEAN NOT NULL DEFAULT true,
          ultimo_sync TIMESTAMPTZ,
          ultimo_sync_status VARCHAR(50),
          ultimo_sync_erro TEXT,
          ultimo_sync_total INTEGER NOT NULL DEFAULT 0,
          criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
          atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT uq_gerencia_board_monday_id UNIQUE (monday_board_id)
        )
        """
    )
    op.execute("CREATE INDEX ix_gerencia_boards_incluido ON gerencia.boards (incluido)")

    # ---- gerencia.itens ----
    op.execute(
        """
        CREATE TABLE gerencia.itens (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          board_id UUID NOT NULL REFERENCES gerencia.boards(id) ON DELETE CASCADE,
          monday_item_id BIGINT NOT NULL,
          nome TEXT,
          grupo VARCHAR(255),
          status VARCHAR(255),
          responsaveis JSONB NOT NULL DEFAULT '[]'::jsonb,
          prazo_inicio DATE,
          prazo_fim DATE,
          concluido BOOLEAN NOT NULL DEFAULT false,
          atrasado BOOLEAN NOT NULL DEFAULT false,
          criado_monday TIMESTAMPTZ,
          atualizado_monday TIMESTAMPTZ,
          raw JSONB NOT NULL DEFAULT '{}'::jsonb,
          sincronizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT uq_gerencia_item UNIQUE (board_id, monday_item_id)
        )
        """
    )
    op.execute("CREATE INDEX ix_gerencia_itens_board_status ON gerencia.itens (board_id, status)")
    op.execute("CREATE INDEX ix_gerencia_itens_board_prazo ON gerencia.itens (board_id, prazo_fim)")
    op.execute("CREATE INDEX ix_gerencia_itens_board_atrasado ON gerencia.itens (board_id, atrasado)")

    # ---- gerencia.snapshots_diarios ----
    op.execute(
        """
        CREATE TABLE gerencia.snapshots_diarios (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          board_id UUID NOT NULL REFERENCES gerencia.boards(id) ON DELETE CASCADE,
          data DATE NOT NULL,
          total INTEGER NOT NULL DEFAULT 0,
          em_andamento INTEGER NOT NULL DEFAULT 0,
          atrasadas INTEGER NOT NULL DEFAULT 0,
          concluidas INTEGER NOT NULL DEFAULT 0,
          sem_responsavel INTEGER NOT NULL DEFAULT 0,
          sem_prazo INTEGER NOT NULL DEFAULT 0,
          metricas JSONB NOT NULL DEFAULT '{}'::jsonb,
          CONSTRAINT uq_gerencia_snapshot UNIQUE (board_id, data)
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS gerencia.snapshots_diarios")
    op.execute("DROP TABLE IF EXISTS gerencia.itens")
    op.execute("DROP TABLE IF EXISTS gerencia.boards")
    op.execute("DROP SCHEMA IF EXISTS gerencia")

    # Restaura o CHECK de core.integracoes sem 'monday'.
    op.execute("ALTER TABLE core.integracoes DROP CONSTRAINT IF EXISTS ck_integracoes_servico")
    op.execute(
        f"ALTER TABLE core.integracoes ADD CONSTRAINT ck_integracoes_servico "
        f"CHECK (servico IN ({_SERVICOS_ANTES}))"
    )
