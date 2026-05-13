"""hotmart: campos novos — taxa, payment.type vs method, is_subscription, commission_as

Revision ID: d4f9a5e6b703
Revises: c3e8f9a4d1b5
Create Date: 2026-05-13 02:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4f9a5e6b703"
down_revision: Union[str, None] = "c3e8f9a4d1b5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "vendas_hotmart",
        sa.Column("taxa_hotmart", sa.Numeric(14, 2)),
        schema="mkt",
    )
    op.add_column(
        "vendas_hotmart",
        sa.Column("meio_pagamento_detalhe", sa.String(150)),
        schema="mkt",
    )
    op.add_column(
        "vendas_hotmart",
        sa.Column("is_subscription", sa.Boolean()),
        schema="mkt",
    )
    op.add_column(
        "vendas_hotmart",
        sa.Column("commission_as", sa.String(30)),
        schema="mkt",
    )


def downgrade() -> None:
    op.drop_column("vendas_hotmart", "commission_as", schema="mkt")
    op.drop_column("vendas_hotmart", "is_subscription", schema="mkt")
    op.drop_column("vendas_hotmart", "meio_pagamento_detalhe", schema="mkt")
    op.drop_column("vendas_hotmart", "taxa_hotmart", schema="mkt")
