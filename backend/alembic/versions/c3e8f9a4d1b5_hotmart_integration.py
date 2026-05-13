"""hotmart integration: integracoes table + utm fields in vendas_hotmart

Revision ID: c3e8f9a4d1b5
Revises: b2d5g8e3f902
Create Date: 2026-05-13 00:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c3e8f9a4d1b5"
down_revision: Union[str, None] = "b2d5g8e3f902"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ---------- core.integracoes ----------
    op.create_table(
        "integracoes",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("servico", sa.String(50), nullable=False, unique=True),
        sa.Column("ativo", sa.Boolean, server_default=sa.text("true"), nullable=False),
        sa.Column("credentials_cifradas", sa.Text),  # JSON cifrado com Fernet
        sa.Column(
            "config_extra",
            postgresql.JSONB,
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("ultimo_sync", sa.DateTime(timezone=True)),
        sa.Column("ultimo_sync_status", sa.String(50)),
        sa.Column("ultimo_sync_erro", sa.Text),
        sa.Column("ultimo_sync_total", sa.Integer, server_default=sa.text("0")),
        sa.Column(
            "criado_em",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "atualizado_em",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "servico IN ('hotmart','meta_ads','meta_instagram','meta_whatsapp','exact_sales')",
            name="ck_integracoes_servico",
        ),
        schema="core",
    )

    # trigger pra atualizar updated_at
    op.execute(
        """
        CREATE OR REPLACE FUNCTION core.trg_integracoes_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.atualizado_em = now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER integracoes_updated_at
        BEFORE UPDATE ON core.integracoes
        FOR EACH ROW
        EXECUTE FUNCTION core.trg_integracoes_updated_at();
        """
    )

    # ---------- novos campos em mkt.vendas_hotmart ----------
    op.add_column("vendas_hotmart", sa.Column("utm_source", sa.String(100)), schema="mkt")
    op.add_column("vendas_hotmart", sa.Column("utm_medium", sa.String(100)), schema="mkt")
    op.add_column("vendas_hotmart", sa.Column("utm_campaign", sa.String(150)), schema="mkt")
    op.add_column("vendas_hotmart", sa.Column("utm_term", sa.String(150)), schema="mkt")
    op.add_column("vendas_hotmart", sa.Column("utm_content", sa.String(150)), schema="mkt")
    op.add_column(
        "vendas_hotmart",
        sa.Column(
            "tracking_codes_raw",
            postgresql.JSONB,
            server_default=sa.text("'{}'::jsonb"),
        ),
        schema="mkt",
    )
    op.add_column(
        "vendas_hotmart",
        sa.Column(
            "matched_via",
            sa.String(30),
        ),
        schema="mkt",
    )
    op.add_column(
        "vendas_hotmart",
        sa.Column(
            "anon_id_match",
            sa.String(64),
        ),
        schema="mkt",
    )

    op.create_index(
        "ix_vendas_hotmart_cliente_email",
        "vendas_hotmart",
        ["cliente_email"],
        schema="mkt",
    )
    op.create_index(
        "ix_vendas_hotmart_data_venda",
        "vendas_hotmart",
        ["data_venda"],
        schema="mkt",
    )
    op.create_index(
        "ix_vendas_hotmart_utm_campaign",
        "vendas_hotmart",
        ["utm_campaign"],
        schema="mkt",
    )


def downgrade() -> None:
    op.drop_index("ix_vendas_hotmart_utm_campaign", table_name="vendas_hotmart", schema="mkt")
    op.drop_index("ix_vendas_hotmart_data_venda", table_name="vendas_hotmart", schema="mkt")
    op.drop_index("ix_vendas_hotmart_cliente_email", table_name="vendas_hotmart", schema="mkt")
    op.drop_column("vendas_hotmart", "anon_id_match", schema="mkt")
    op.drop_column("vendas_hotmart", "matched_via", schema="mkt")
    op.drop_column("vendas_hotmart", "tracking_codes_raw", schema="mkt")
    op.drop_column("vendas_hotmart", "utm_content", schema="mkt")
    op.drop_column("vendas_hotmart", "utm_term", schema="mkt")
    op.drop_column("vendas_hotmart", "utm_campaign", schema="mkt")
    op.drop_column("vendas_hotmart", "utm_medium", schema="mkt")
    op.drop_column("vendas_hotmart", "utm_source", schema="mkt")

    op.execute("DROP TRIGGER IF EXISTS integracoes_updated_at ON core.integracoes")
    op.execute("DROP FUNCTION IF EXISTS core.trg_integracoes_updated_at()")
    op.drop_table("integracoes", schema="core")
