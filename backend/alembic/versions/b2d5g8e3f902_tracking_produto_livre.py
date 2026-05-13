"""tracking: produto como texto livre

Revision ID: b2d5g8e3f902
Revises: a1c4f7d2e801
Create Date: 2026-05-12 23:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2d5g8e3f902"
down_revision: Union[str, None] = "a1c4f7d2e801"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "utm_links",
        sa.Column("produto_nome", sa.String(255), nullable=True),
        schema="tracking",
    )
    op.add_column(
        "eventos",
        sa.Column("produto_nome", sa.String(255), nullable=True),
        schema="tracking",
    )
    op.create_index(
        "ix_eventos_produto_nome",
        "eventos",
        ["produto_nome"],
        schema="tracking",
    )


def downgrade() -> None:
    op.drop_index("ix_eventos_produto_nome", table_name="eventos", schema="tracking")
    op.drop_column("eventos", "produto_nome", schema="tracking")
    op.drop_column("utm_links", "produto_nome", schema="tracking")
