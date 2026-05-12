"""marketing frente periodo

Revision ID: 71e4a4a5db9d
Revises: 935e6510b698
Create Date: 2026-05-12 04:50:17.288905

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '71e4a4a5db9d'
down_revision: Union[str, None] = '935e6510b698'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'frente_periodo',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('frente', sa.String(20), nullable=False),
        sa.Column('ano', sa.Integer, nullable=False),
        sa.Column('mes', sa.Integer, nullable=False),
        sa.Column('evento_nome', sa.String(500), nullable=False),
        sa.Column('evento_id', postgresql.UUID(as_uuid=True), nullable=True),

        sa.Column('investimento_ads', sa.Numeric(12, 2), server_default=sa.text('0')),

        sa.Column('alcance', sa.BigInteger, server_default=sa.text('0')),
        sa.Column('cliques', sa.Integer, server_default=sa.text('0')),
        sa.Column('visitantes_lp', sa.Integer, server_default=sa.text('0')),
        sa.Column('checkout', sa.Integer, server_default=sa.text('0')),
        sa.Column('compras', sa.Integer, server_default=sa.text('0')),

        sa.Column('meta_leads', sa.Integer, nullable=True),
        sa.Column('leads', sa.Integer, nullable=True),
        sa.Column('meta_ligacao', sa.Integer, nullable=True),
        sa.Column('ligacao', sa.Integer, nullable=True),
        sa.Column('meta_sql', sa.Integer, nullable=True),
        sa.Column('sql_reuniao', sa.Integer, nullable=True),
        sa.Column('meta_reuniao', sa.Integer, nullable=True),
        sa.Column('reuniao_realizada', sa.Integer, nullable=True),
        sa.Column('meta_vendas', sa.Integer, nullable=True),
        sa.Column('vendas', sa.Integer, nullable=True),

        sa.Column('meta_inscritos', sa.Integer, server_default=sa.text('0')),
        sa.Column('inscritos', sa.Integer, server_default=sa.text('0')),
        sa.Column('meta_receita', sa.Numeric(12, 2), server_default=sa.text('0')),
        sa.Column('receita', sa.Numeric(12, 2), server_default=sa.text('0')),

        sa.Column('ticket_medio', sa.Numeric(12, 2), nullable=True),
        sa.Column('taxa_doity', sa.Numeric(6, 4), nullable=True),
        sa.Column('no_show_pct', sa.Numeric(6, 4), nullable=True),

        sa.Column('extras', postgresql.JSONB, server_default=sa.text("'{}'::jsonb")),

        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),

        sa.UniqueConstraint('frente', 'ano', 'mes', 'evento_nome',
                            name='uq_frente_periodo_evento'),
        sa.CheckConstraint('mes BETWEEN 1 AND 12', name='ck_mes_valido'),
        sa.CheckConstraint("frente IN ('pos','congresso','curso','comunidade')",
                           name='ck_frente_valida'),
        schema='mkt',
    )

    op.create_index('ix_frente_periodo_frente_ano_mes',
                    'frente_periodo',
                    ['frente', 'ano', 'mes'],
                    schema='mkt')
    op.create_index('ix_frente_periodo_ano_mes',
                    'frente_periodo',
                    ['ano', 'mes'],
                    schema='mkt')

    # Trigger pra updated_at
    op.execute("""
        CREATE OR REPLACE FUNCTION mkt.trg_frente_periodo_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER frente_periodo_updated_at
        BEFORE UPDATE ON mkt.frente_periodo
        FOR EACH ROW
        EXECUTE FUNCTION mkt.trg_frente_periodo_updated_at();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS frente_periodo_updated_at ON mkt.frente_periodo")
    op.execute("DROP FUNCTION IF EXISTS mkt.trg_frente_periodo_updated_at()")
    op.drop_index('ix_frente_periodo_ano_mes', table_name='frente_periodo', schema='mkt')
    op.drop_index('ix_frente_periodo_frente_ano_mes', table_name='frente_periodo', schema='mkt')
    op.drop_table('frente_periodo', schema='mkt')
