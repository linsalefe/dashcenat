"""meta_ads: cria tabelas de insights diários e custom conversions

Revision ID: a3f8e9d2b416
Revises: f7b2c4e9d518
Create Date: 2026-05-16 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "a3f8e9d2b416"
down_revision: Union[str, None] = "f7b2c4e9d518"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ============================================================
    # mkt.meta_ads_insights — linha diária por (data, conta, campaign[, adset, ad])
    # ============================================================
    op.create_table(
        "meta_ads_insights",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("data", sa.Date(), nullable=False),
        sa.Column("ad_account_id", sa.String(length=64), nullable=False),
        sa.Column("campaign_id", sa.String(length=64), nullable=False),
        sa.Column("campaign_name", sa.String(length=255), nullable=False),
        sa.Column("objetivo", sa.String(length=64), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=True),
        sa.Column("adset_id", sa.String(length=64), nullable=True),
        sa.Column("adset_name", sa.String(length=255), nullable=True),
        sa.Column("ad_id", sa.String(length=64), nullable=True),
        sa.Column("ad_name", sa.String(length=255), nullable=True),
        # Mídia
        sa.Column("spend", sa.Numeric(12, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("reach", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("impressions", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("clicks", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("ctr", sa.Numeric(8, 4), nullable=True),
        sa.Column("cpc", sa.Numeric(10, 4), nullable=True),
        sa.Column("cpm", sa.Numeric(10, 2), nullable=True),
        sa.Column("frequency", sa.Numeric(6, 2), nullable=True),
        # Funil
        sa.Column(
            "landing_page_views", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column(
            "initiate_checkout", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column("purchases", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "purchase_value", sa.Numeric(14, 2), nullable=False, server_default=sa.text("0")
        ),
        sa.Column(
            "complete_registration", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        # Custom conversions
        sa.Column("custom_conversions", postgresql.JSONB(), nullable=True),
        sa.Column(
            "custom_conversions_total",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        # Mapeamento
        sa.Column("utm_campaign_inferido", sa.String(length=255), nullable=True),
        sa.Column("raw_payload", postgresql.JSONB(), nullable=True),
        sa.Column(
            "sincronizado_em",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        schema="mkt",
    )

    # Índice UNIQUE funcional — adset_id / ad_id NULL viram '' pra evitar duplicar em level=campaign
    op.execute(
        """
        CREATE UNIQUE INDEX uq_meta_ads_insights
          ON mkt.meta_ads_insights (
            data,
            ad_account_id,
            campaign_id,
            COALESCE(adset_id, ''),
            COALESCE(ad_id, '')
          )
        """
    )

    op.create_index(
        "ix_meta_ads_data",
        "meta_ads_insights",
        [sa.text("data DESC")],
        schema="mkt",
    )
    op.create_index(
        "ix_meta_ads_campaign",
        "meta_ads_insights",
        ["campaign_id"],
        schema="mkt",
    )
    op.create_index(
        "ix_meta_ads_objetivo",
        "meta_ads_insights",
        ["objetivo"],
        schema="mkt",
    )
    op.create_index(
        "ix_meta_ads_utm",
        "meta_ads_insights",
        ["utm_campaign_inferido"],
        schema="mkt",
    )

    # ============================================================
    # mkt.meta_custom_conversions — cadastro de conversões customizadas
    # ============================================================
    op.create_table(
        "meta_custom_conversions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("custom_conversion_id", sa.String(length=64), nullable=False),
        sa.Column("ad_account_id", sa.String(length=64), nullable=False),
        sa.Column("nome", sa.String(length=255), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("custom_event_type", sa.String(length=64), nullable=True),
        sa.Column(
            "ativo", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column(
            "sincronizado_em",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint(
            "custom_conversion_id",
            "ad_account_id",
            name="uq_meta_custom_conv",
        ),
        schema="mkt",
    )


def downgrade() -> None:
    op.drop_table("meta_custom_conversions", schema="mkt")
    op.drop_index("ix_meta_ads_utm", table_name="meta_ads_insights", schema="mkt")
    op.drop_index("ix_meta_ads_objetivo", table_name="meta_ads_insights", schema="mkt")
    op.drop_index("ix_meta_ads_campaign", table_name="meta_ads_insights", schema="mkt")
    op.drop_index("ix_meta_ads_data", table_name="meta_ads_insights", schema="mkt")
    op.execute("DROP INDEX IF EXISTS mkt.uq_meta_ads_insights")
    op.drop_table("meta_ads_insights", schema="mkt")
