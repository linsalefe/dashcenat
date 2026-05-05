"""add meta_ads_campanhas vendas_hotmart lancamentos intercambio

Revision ID: 935e6510b698
Revises: b390d859fc2a
Create Date: 2026-05-05 16:10:44.234091

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '935e6510b698'
down_revision: Union[str, None] = 'b390d859fc2a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ───────────────────────────────────────────────────────
    # 1) mkt.meta_ads_campanhas — UPSERT por (ano, mes, nome_campanha)
    # ───────────────────────────────────────────────────────
    op.create_table(
        'meta_ads_campanhas',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('ano', sa.Integer, nullable=False),
        sa.Column('mes', sa.Integer, nullable=False),
        sa.Column('nome_campanha', sa.String(500), nullable=False),
        sa.Column('veiculacao', sa.String(50)),
        sa.Column('orcamento_diario', sa.Numeric(12, 2)),
        sa.Column('investimento', sa.Numeric(12, 2), server_default=sa.text('0')),
        sa.Column('impressoes', sa.BigInteger, server_default=sa.text('0')),
        sa.Column('alcance', sa.BigInteger, server_default=sa.text('0')),
        sa.Column('cliques', sa.Integer, server_default=sa.text('0')),
        sa.Column('cpm', sa.Numeric(10, 4)),
        sa.Column('cpc', sa.Numeric(10, 4)),
        sa.Column('ctr', sa.Numeric(8, 4)),
        sa.Column('frequencia', sa.Numeric(8, 4)),
        sa.Column('resultados', sa.Integer, server_default=sa.text('0')),
        sa.Column('indicador_resultado', sa.String(200)),
        sa.Column('custo_por_resultado', sa.Numeric(12, 4)),
        sa.Column('leads', sa.Integer, server_default=sa.text('0')),
        sa.Column('leads_imersao', sa.Integer, server_default=sa.text('0')),
        sa.Column('compras', sa.Integer, server_default=sa.text('0')),
        sa.Column('valor_resultados', sa.Numeric(14, 2), server_default=sa.text('0')),
        sa.Column('observacao', sa.Text),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('atualizado_em', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('ano', 'mes', 'nome_campanha', name='uq_meta_ads_periodo_campanha'),
        sa.CheckConstraint('mes BETWEEN 1 AND 12', name='ck_meta_ads_mes'),
        schema='mkt',
    )
    op.create_index('ix_meta_ads_ano_mes', 'meta_ads_campanhas', ['ano', 'mes'], schema='mkt')
    op.create_index('ix_meta_ads_invest', 'meta_ads_campanhas', ['investimento'], schema='mkt',
                    postgresql_ops={'investimento': 'DESC'})

    # ───────────────────────────────────────────────────────
    # 2) mkt.vendas_hotmart — UPSERT por transacao
    # ───────────────────────────────────────────────────────
    op.create_table(
        'vendas_hotmart',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('transacao', sa.String(100), nullable=False),
        sa.Column('produto', sa.String(500), nullable=False),
        sa.Column('produtor', sa.String(200)),
        sa.Column('afiliado', sa.String(200)),
        sa.Column('meio_pagamento', sa.String(50)),
        sa.Column('moeda', sa.String(10)),
        sa.Column('preco_total', sa.Numeric(14, 2), server_default=sa.text('0')),
        sa.Column('faturamento_liquido', sa.Numeric(14, 2), server_default=sa.text('0')),
        sa.Column('numero_parcela', sa.Integer),
        sa.Column('recorrencia', sa.String(50)),
        sa.Column('data_venda', sa.DateTime(timezone=False)),
        sa.Column('data_confirmacao', sa.DateTime(timezone=False)),
        sa.Column('status', sa.String(50)),
        sa.Column('cliente_nome', sa.String(300)),
        sa.Column('cliente_email', sa.String(200)),
        sa.Column('cliente_estado', sa.String(10)),
        sa.Column('cliente_pais', sa.String(50)),
        sa.Column('codigo_produto', sa.String(50)),
        sa.Column('codigo_oferta', sa.String(50)),
        sa.Column('tipo_pagamento_oferta', sa.String(100)),
        sa.Column('observacao', sa.Text),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('atualizado_em', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('transacao', name='uq_vendas_hotmart_transacao'),
        schema='mkt',
    )
    op.create_index('ix_vendas_hotmart_data', 'vendas_hotmart', ['data_venda'], schema='mkt')
    op.create_index('ix_vendas_hotmart_status', 'vendas_hotmart', ['status'], schema='mkt')
    op.create_index('ix_vendas_hotmart_produto', 'vendas_hotmart', ['produto'], schema='mkt')

    # ───────────────────────────────────────────────────────
    # 3) mkt.lancamentos — UPSERT por (ano, mes, nome)
    # ───────────────────────────────────────────────────────
    op.create_table(
        'lancamentos',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('ano', sa.Integer, nullable=False),
        sa.Column('mes', sa.Integer, nullable=False),
        sa.Column('nome', sa.String(200), nullable=False),
        sa.Column('investimento_meta', sa.Numeric(12, 2)),
        sa.Column('investimento_resultado', sa.Numeric(12, 2)),
        sa.Column('leads_meta', sa.Integer),
        sa.Column('leads_organico', sa.Integer, server_default=sa.text('0')),
        sa.Column('leads_pago', sa.Integer, server_default=sa.text('0')),
        sa.Column('leads_total', sa.Integer, server_default=sa.text('0')),
        sa.Column('cpl_meta', sa.Numeric(10, 4)),
        sa.Column('cpl_resultado', sa.Numeric(10, 4)),
        sa.Column('mqls_meta', sa.Integer),
        sa.Column('mqls_resultado', sa.Integer),
        sa.Column('alunos_meta', sa.Integer),
        sa.Column('alunos_resultado', sa.Integer),
        sa.Column('receita_meta', sa.Numeric(14, 2)),
        sa.Column('receita_resultado', sa.Numeric(14, 2)),
        sa.Column('engajamento', postgresql.JSONB,
                  server_default=sa.text("'{}'::jsonb")),
        sa.Column('observacao', sa.Text),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('atualizado_em', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('ano', 'mes', 'nome', name='uq_lancamento_periodo_nome'),
        sa.CheckConstraint('mes BETWEEN 1 AND 12', name='ck_lancamentos_mes'),
        schema='mkt',
    )
    op.create_index('ix_lancamentos_ano_mes', 'lancamentos', ['ano', 'mes'], schema='mkt')

    # ───────────────────────────────────────────────────────
    # 4) comercial.intercambio — cadastro manual
    # ───────────────────────────────────────────────────────
    op.create_table(
        'intercambio',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('nome_aluno', sa.String(300), nullable=False),
        sa.Column('valor', sa.Numeric(14, 2), nullable=False),
        sa.Column('data_venda', sa.Date, nullable=False),
        sa.Column('observacao', sa.Text),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('atualizado_em', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        schema='comercial',
    )
    op.create_index('ix_intercambio_data', 'intercambio', ['data_venda'], schema='comercial')


def downgrade() -> None:
    op.drop_index('ix_intercambio_data', table_name='intercambio', schema='comercial')
    op.drop_table('intercambio', schema='comercial')

    op.drop_index('ix_lancamentos_ano_mes', table_name='lancamentos', schema='mkt')
    op.drop_table('lancamentos', schema='mkt')

    op.drop_index('ix_vendas_hotmart_produto', table_name='vendas_hotmart', schema='mkt')
    op.drop_index('ix_vendas_hotmart_status', table_name='vendas_hotmart', schema='mkt')
    op.drop_index('ix_vendas_hotmart_data', table_name='vendas_hotmart', schema='mkt')
    op.drop_table('vendas_hotmart', schema='mkt')

    op.drop_index('ix_meta_ads_invest', table_name='meta_ads_campanhas', schema='mkt')
    op.drop_index('ix_meta_ads_ano_mes', table_name='meta_ads_campanhas', schema='mkt')
    op.drop_table('meta_ads_campanhas', schema='mkt')
