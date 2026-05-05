"""indices and views for comercial dashboards

Revision ID: b390d859fc2a
Revises: a5391192c53d
Create Date: 2026-05-05 04:45:06.480666

Adiciona 7 índices em comercial e mkt + 3 views derivadas que os
dashboards do Sprint 2 vão consumir. Idempotente.

DashCENAT Sprint 2 — Etapa 3.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = 'b390d859fc2a'
down_revision: Union[str, None] = 'a5391192c53d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── Índices ───
    op.execute("CREATE INDEX IF NOT EXISTS idx_funil_periodo ON comercial.funil_resultado (ano, mes);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_funil_produto ON comercial.funil_resultado (produto_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_vendas_periodo ON comercial.vendas (data_venda);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_vendas_produto ON comercial.vendas (produto_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_reunioes_periodo ON comercial.reunioes (data_agendada);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_metricas_periodo ON mkt.metricas_canal (ano, mes);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_metricas_canal_indicador ON mkt.metricas_canal (canal_id, indicador);")

    # ─── View: comercial.v_taxa_conversao ───
    op.execute("""
        CREATE OR REPLACE VIEW comercial.v_taxa_conversao AS
        WITH pivoted AS (
            SELECT
                produto_id, ano, mes,
                MAX(CASE WHEN etapa_id = 1 THEN resultado END) AS leads,
                MAX(CASE WHEN etapa_id = 2 THEN resultado END) AS ligacao,
                MAX(CASE WHEN etapa_id = 3 THEN resultado END) AS sql_reuniao,
                MAX(CASE WHEN etapa_id = 4 THEN resultado END) AS reuniao_realizada,
                MAX(CASE WHEN etapa_id = 5 THEN resultado END) AS venda,
                MAX(CASE WHEN etapa_id = 1 THEN meta END) AS meta_leads,
                MAX(CASE WHEN etapa_id = 2 THEN meta END) AS meta_ligacao,
                MAX(CASE WHEN etapa_id = 3 THEN meta END) AS meta_sql_reuniao,
                MAX(CASE WHEN etapa_id = 4 THEN meta END) AS meta_reuniao_realizada,
                MAX(CASE WHEN etapa_id = 5 THEN meta END) AS meta_venda
            FROM comercial.funil_resultado
            GROUP BY produto_id, ano, mes
        )
        SELECT
            produto_id, ano, mes,
            leads, ligacao, sql_reuniao, reuniao_realizada, venda,
            meta_leads, meta_ligacao, meta_sql_reuniao, meta_reuniao_realizada, meta_venda,
            CASE WHEN leads > 0 THEN ligacao / leads END AS taxa_lead_ligacao,
            CASE WHEN ligacao > 0 THEN sql_reuniao / ligacao END AS taxa_ligacao_sql,
            CASE WHEN sql_reuniao > 0 THEN reuniao_realizada / sql_reuniao END AS taxa_sql_reuniao,
            CASE WHEN reuniao_realizada > 0 THEN venda / reuniao_realizada END AS taxa_reuniao_venda,
            CASE WHEN leads > 0 THEN venda / leads END AS taxa_lead_venda
        FROM pivoted;
    """)

    # ─── View: comercial.v_ticket_medio ───
    op.execute("""
        CREATE OR REPLACE VIEW comercial.v_ticket_medio AS
        SELECT
            produto_id,
            EXTRACT(YEAR FROM data_venda)::INT AS ano,
            EXTRACT(MONTH FROM data_venda)::INT AS mes,
            COUNT(*) AS qtd_vendas,
            SUM(valor) AS receita_total,
            AVG(valor) AS ticket_medio,
            AVG(prazo_recebimento_meses) AS prazo_medio,
            CASE WHEN COUNT(*) > 0
                THEN SUM(CASE WHEN a_vista THEN 1 ELSE 0 END)::FLOAT / COUNT(*)
            END AS pct_a_vista
        FROM comercial.vendas
        GROUP BY produto_id, EXTRACT(YEAR FROM data_venda), EXTRACT(MONTH FROM data_venda);
    """)

    # ─── View: comercial.v_no_show ───
    op.execute("""
        CREATE OR REPLACE VIEW comercial.v_no_show AS
        SELECT
            produto_id,
            EXTRACT(YEAR FROM data_agendada)::INT AS ano,
            EXTRACT(MONTH FROM data_agendada)::INT AS mes,
            COUNT(*) AS reunioes_agendadas,
            SUM(CASE WHEN no_show THEN 1 ELSE 0 END) AS no_shows,
            SUM(CASE WHEN data_realizada IS NOT NULL THEN 1 ELSE 0 END) AS realizadas,
            SUM(CASE WHEN resultou_em_venda THEN 1 ELSE 0 END) AS vendas_via_reuniao,
            CASE WHEN COUNT(*) > 0
                THEN SUM(CASE WHEN no_show THEN 1 ELSE 0 END)::FLOAT / COUNT(*)
            END AS taxa_no_show,
            CASE WHEN SUM(CASE WHEN data_realizada IS NOT NULL THEN 1 ELSE 0 END) > 0
                THEN SUM(CASE WHEN resultou_em_venda THEN 1 ELSE 0 END)::FLOAT
                     / SUM(CASE WHEN data_realizada IS NOT NULL THEN 1 ELSE 0 END)
            END AS taxa_reuniao_venda
        FROM comercial.reunioes
        GROUP BY produto_id, EXTRACT(YEAR FROM data_agendada), EXTRACT(MONTH FROM data_agendada);
    """)


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS comercial.v_no_show")
    op.execute("DROP VIEW IF EXISTS comercial.v_ticket_medio")
    op.execute("DROP VIEW IF EXISTS comercial.v_taxa_conversao")
    for idx in ["idx_metricas_canal_indicador", "idx_metricas_periodo"]:
        op.execute(f"DROP INDEX IF EXISTS mkt.{idx}")
    for idx in ["idx_reunioes_periodo", "idx_vendas_produto", "idx_vendas_periodo",
                "idx_funil_produto", "idx_funil_periodo"]:
        op.execute(f"DROP INDEX IF EXISTS comercial.{idx}")
