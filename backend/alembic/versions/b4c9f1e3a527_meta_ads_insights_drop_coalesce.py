"""meta_ads_insights: adset_id/ad_id NOT NULL DEFAULT '' + índice UNIQUE sem COALESCE

Motivo: ON CONFLICT em índice funcional com COALESCE é frágil — Postgres exige
match literal de cast que SQLAlchemy não garante. Eliminamos o COALESCE tornando
adset_id e ad_id NOT NULL com default '' e recriando o índice UNIQUE direto nas
colunas.

Revision ID: b4c9f1e3a527
Revises: a3f8e9d2b416
Create Date: 2026-05-16 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "b4c9f1e3a527"
down_revision: Union[str, None] = "a3f8e9d2b416"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Normaliza NULLs existentes (provavelmente nenhum, mas garantir)
    op.execute("UPDATE mkt.meta_ads_insights SET adset_id = '' WHERE adset_id IS NULL")
    op.execute("UPDATE mkt.meta_ads_insights SET ad_id   = '' WHERE ad_id   IS NULL")

    # 2) NOT NULL + DEFAULT ''
    op.execute(
        """
        ALTER TABLE mkt.meta_ads_insights
          ALTER COLUMN adset_id SET DEFAULT '',
          ALTER COLUMN adset_id SET NOT NULL,
          ALTER COLUMN ad_id    SET DEFAULT '',
          ALTER COLUMN ad_id    SET NOT NULL
        """
    )

    # 3) Recria o índice UNIQUE sem COALESCE
    op.execute("DROP INDEX IF EXISTS mkt.uq_meta_ads_insights")
    op.execute(
        """
        CREATE UNIQUE INDEX uq_meta_ads_insights
          ON mkt.meta_ads_insights (data, ad_account_id, campaign_id, adset_id, ad_id)
        """
    )


def downgrade() -> None:
    # Volta ao índice funcional com COALESCE
    op.execute("DROP INDEX IF EXISTS mkt.uq_meta_ads_insights")
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

    # Volta colunas pra nullable, sem default
    op.execute(
        """
        ALTER TABLE mkt.meta_ads_insights
          ALTER COLUMN adset_id DROP NOT NULL,
          ALTER COLUMN adset_id DROP DEFAULT,
          ALTER COLUMN ad_id    DROP NOT NULL,
          ALTER COLUMN ad_id    DROP DEFAULT
        """
    )
