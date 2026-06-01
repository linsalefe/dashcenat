"""doity integration: eventos cols + vendas_doity

Revision ID: f7c982f9b1a7
Revises: j5f1e9c6d843
Create Date: 2026-06-01 21:08:54.855639

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "f7c982f9b1a7"
down_revision: Union[str, None] = "j5f1e9c6d843"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ---------- core.eventos: colunas doity_* ----------
    op.add_column(
        "eventos",
        sa.Column("doity_event_id", sa.Integer(), nullable=True),
        schema="core",
    )
    op.add_column(
        "eventos",
        sa.Column("doity_credentials_cifradas", sa.Text(), nullable=True),
        schema="core",
    )
    op.add_column(
        "eventos",
        sa.Column(
            "doity_situacoes_pagas",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[1, 4]'::jsonb"),
            nullable=False,
        ),
        schema="core",
    )
    op.add_column(
        "eventos",
        sa.Column("doity_campo_whatsapp", sa.String(length=200), nullable=True),
        schema="core",
    )
    op.add_column(
        "eventos",
        sa.Column("doity_cursor", sa.DateTime(timezone=True), nullable=True),
        schema="core",
    )
    op.add_column(
        "eventos",
        sa.Column("doity_ultimo_sync", sa.DateTime(timezone=True), nullable=True),
        schema="core",
    )
    op.add_column(
        "eventos",
        sa.Column("doity_ultimo_sync_status", sa.String(length=50), nullable=True),
        schema="core",
    )
    op.add_column(
        "eventos",
        sa.Column("doity_ultimo_sync_erro", sa.Text(), nullable=True),
        schema="core",
    )
    op.add_column(
        "eventos",
        sa.Column(
            "doity_ultimo_sync_total",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        schema="core",
    )
    op.create_index(
        op.f("ix_core_eventos_doity_event_id"),
        "eventos",
        ["doity_event_id"],
        unique=False,
        schema="core",
    )

    # ---------- mkt.vendas_doity ----------
    op.create_table(
        "vendas_doity",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("evento_id", sa.UUID(), nullable=False),
        sa.Column("doity_participante_id", sa.Integer(), nullable=False),
        sa.Column("nome", sa.String(length=300), nullable=True),
        sa.Column("pago", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "em_contestacao",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("situacao_codigo", sa.Integer(), nullable=True),
        sa.Column("situacao_descricao", sa.String(length=100), nullable=True),
        sa.Column("valor_pago", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("valor_recebido", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("forma_pagamento", sa.String(length=100), nullable=True),
        sa.Column("data_inscricao", sa.Date(), nullable=True),
        sa.Column("comprador_email", sa.String(length=200), nullable=True),
        sa.Column("comprador_telefone", sa.String(length=30), nullable=True),
        sa.Column("comprador_cpf", sa.String(length=20), nullable=True),
        sa.Column("whatsapp", sa.String(length=30), nullable=True),
        sa.Column("cidade", sa.String(length=120), nullable=True),
        sa.Column("estado", sa.String(length=10), nullable=True),
        sa.Column("profissao", sa.String(length=200), nullable=True),
        sa.Column("genero", sa.String(length=50), nullable=True),
        sa.Column("lote_id", sa.Integer(), nullable=True),
        sa.Column("lote_nome", sa.String(length=200), nullable=True),
        sa.Column("raw", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("data_atualizacao_doity", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "criado_em",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "atualizado_em",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["evento_id"], ["core.eventos.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "evento_id",
            "doity_participante_id",
            name="uq_vendas_doity_evento_part",
        ),
        schema="mkt",
    )
    op.create_index(
        op.f("ix_mkt_vendas_doity_evento_id"),
        "vendas_doity",
        ["evento_id"],
        unique=False,
        schema="mkt",
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_mkt_vendas_doity_evento_id"),
        table_name="vendas_doity",
        schema="mkt",
    )
    op.drop_table("vendas_doity", schema="mkt")

    op.drop_index(
        op.f("ix_core_eventos_doity_event_id"),
        table_name="eventos",
        schema="core",
    )
    op.drop_column("eventos", "doity_ultimo_sync_total", schema="core")
    op.drop_column("eventos", "doity_ultimo_sync_erro", schema="core")
    op.drop_column("eventos", "doity_ultimo_sync_status", schema="core")
    op.drop_column("eventos", "doity_ultimo_sync", schema="core")
    op.drop_column("eventos", "doity_cursor", schema="core")
    op.drop_column("eventos", "doity_campo_whatsapp", schema="core")
    op.drop_column("eventos", "doity_situacoes_pagas", schema="core")
    op.drop_column("eventos", "doity_credentials_cifradas", schema="core")
    op.drop_column("eventos", "doity_event_id", schema="core")
