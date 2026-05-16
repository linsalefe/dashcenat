"""hotmart: adicionar coluna cta pra mapear qual botão originou a venda

Revision ID: e5a8b3c1d204
Revises: d4f9a5e6b703
Create Date: 2026-05-13 03:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5a8b3c1d204"
down_revision: Union[str, None] = "d4f9a5e6b703"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "vendas_hotmart",
        sa.Column("cta", sa.String(length=80), nullable=True),
        schema="mkt",
    )
    op.create_index(
        "ix_vendas_hotmart_cta",
        "vendas_hotmart",
        ["cta"],
        schema="mkt",
    )


def downgrade() -> None:
    op.drop_index("ix_vendas_hotmart_cta", table_name="vendas_hotmart", schema="mkt")
    op.drop_column("vendas_hotmart", "cta", schema="mkt")
