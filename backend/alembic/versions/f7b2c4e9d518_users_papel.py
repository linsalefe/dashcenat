"""users: papel (admin/user) + ultimo_acesso; promove admin@cenat.com a admin

Revision ID: f7b2c4e9d518
Revises: e5a8b3c1d204
Create Date: 2026-05-13 04:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f7b2c4e9d518"
down_revision: Union[str, None] = "e5a8b3c1d204"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("papel", sa.String(length=20), nullable=False, server_default=sa.text("'user'")),
        schema="core",
    )
    op.add_column(
        "users",
        sa.Column("ultimo_acesso", sa.DateTime(timezone=True), nullable=True),
        schema="core",
    )
    op.create_check_constraint(
        "ck_users_papel",
        "users",
        "papel IN ('admin', 'user')",
        schema="core",
    )

    # Promove o admin original
    op.execute(
        "UPDATE core.users SET papel = 'admin' WHERE email = 'admin@cenat.com'"
    )


def downgrade() -> None:
    op.drop_constraint("ck_users_papel", "users", schema="core", type_="check")
    op.drop_column("users", "ultimo_acesso", schema="core")
    op.drop_column("users", "papel", schema="core")
