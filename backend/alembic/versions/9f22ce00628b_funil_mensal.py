"""funil mensal

Revision ID: 9f22ce00628b
Revises: 71e4a4a5db9d
Create Date: 2026-05-12 14:51:32.456024

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '9f22ce00628b'
down_revision: Union[str, None] = '71e4a4a5db9d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'funil_mensal',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('frente', sa.String(20), nullable=False),
        sa.Column('ano', sa.Integer, nullable=False),
        sa.Column('mes', sa.Integer, nullable=False),

        sa.Column('investimento_ads', sa.Numeric(12, 2),
                  server_default=sa.text('0'), nullable=False),
        sa.Column('alcance', sa.BigInteger,
                  server_default=sa.text('0'), nullable=False),
        sa.Column('cliques', sa.Integer,
                  server_default=sa.text('0'), nullable=False),
        sa.Column('visitantes_lp', sa.Integer,
                  server_default=sa.text('0'), nullable=False),
        sa.Column('checkout', sa.Integer,
                  server_default=sa.text('0'), nullable=False),
        sa.Column('compras', sa.Integer,
                  server_default=sa.text('0'), nullable=False),

        sa.Column('extras', postgresql.JSONB,
                  server_default=sa.text("'{}'::jsonb"), nullable=False),

        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),

        sa.UniqueConstraint('frente', 'ano', 'mes',
                            name='uq_funil_mensal_periodo'),
        sa.CheckConstraint('mes BETWEEN 1 AND 12',
                           name='ck_funil_mes_valido'),
        sa.CheckConstraint(
            "frente IN ('pos','congresso','curso','comunidade')",
            name='ck_funil_frente_valida',
        ),
        schema='mkt',
    )

    op.create_index(
        'ix_funil_mensal_frente_ano_mes',
        'funil_mensal',
        ['frente', 'ano', 'mes'],
        schema='mkt',
    )

    op.execute("""
        CREATE OR REPLACE FUNCTION mkt.trg_funil_mensal_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER funil_mensal_updated_at
        BEFORE UPDATE ON mkt.funil_mensal
        FOR EACH ROW
        EXECUTE FUNCTION mkt.trg_funil_mensal_updated_at();
    """)

    op.execute("""
        INSERT INTO mkt.funil_mensal
            (frente, ano, mes,
             investimento_ads, alcance, cliques,
             visitantes_lp, checkout, compras)
        SELECT
            frente, ano, mes,
            COALESCE(SUM(investimento_ads), 0),
            COALESCE(SUM(alcance), 0),
            COALESCE(SUM(cliques), 0),
            COALESCE(SUM(visitantes_lp), 0),
            COALESCE(SUM(checkout), 0),
            COALESCE(SUM(compras), 0)
        FROM mkt.frente_periodo
        GROUP BY frente, ano, mes
        ON CONFLICT (frente, ano, mes) DO NOTHING
    """)

    op.execute("""
        UPDATE mkt.frente_periodo
        SET investimento_ads = 0,
            alcance = 0,
            cliques = 0,
            visitantes_lp = 0,
            checkout = 0,
            compras = 0
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS funil_mensal_updated_at "
               "ON mkt.funil_mensal")
    op.execute("DROP FUNCTION IF EXISTS mkt.trg_funil_mensal_updated_at()")
    op.drop_index('ix_funil_mensal_frente_ano_mes',
                  table_name='funil_mensal', schema='mkt')
    op.drop_table('funil_mensal', schema='mkt')
