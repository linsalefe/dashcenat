"""tracking schema (utm_links + eventos)

Revision ID: a1c4f7d2e801
Revises: 9f22ce00628b
Create Date: 2026-05-12 23:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "a1c4f7d2e801"
down_revision: Union[str, None] = "9f22ce00628b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS tracking")

    # ---------- utm_links ----------
    op.create_table(
        "utm_links",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("slug", sa.String(20), nullable=False, unique=True),
        sa.Column("nome", sa.String(255), nullable=False),
        sa.Column("url_destino", sa.Text, nullable=False),
        sa.Column("utm_source", sa.String(100), nullable=False),
        sa.Column("utm_medium", sa.String(100), nullable=False),
        sa.Column("utm_campaign", sa.String(150), nullable=False),
        sa.Column("utm_term", sa.String(150)),
        sa.Column("utm_content", sa.String(150)),
        sa.Column(
            "produto_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("core.produtos.id"),
        ),
        sa.Column("canal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("core.canais.id")),
        sa.Column("short_link", sa.Boolean, server_default=sa.text("true"), nullable=False),
        sa.Column("clicks", sa.Integer, server_default=sa.text("0"), nullable=False),
        sa.Column("usuario_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("core.users.id")),
        sa.Column(
            "criado_em",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        schema="tracking",
    )
    op.create_index(
        "ix_utm_links_campaign",
        "utm_links",
        ["utm_campaign"],
        schema="tracking",
    )

    # ---------- eventos ----------
    op.create_table(
        "eventos",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("tipo", sa.String(20), nullable=False),  # pageview | click | conversion
        sa.Column("site", sa.String(100)),  # data-site do snippet (cenat, posgrad, etc.)
        sa.Column("anon_id", sa.String(64)),  # cookie/localStorage id
        sa.Column("session_id", sa.String(64)),
        sa.Column("url", sa.Text),
        sa.Column("path", sa.String(500)),
        sa.Column("referrer", sa.Text),
        sa.Column("utm_source", sa.String(100)),
        sa.Column("utm_medium", sa.String(100)),
        sa.Column("utm_campaign", sa.String(150)),
        sa.Column("utm_term", sa.String(150)),
        sa.Column("utm_content", sa.String(150)),
        sa.Column("utm_link_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tracking.utm_links.id")),
        sa.Column("produto_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("core.produtos.id")),
        sa.Column("evento_nome", sa.String(150)),  # custom name (ex: 'click_cta_hero')
        sa.Column("valor", sa.Numeric(14, 2)),
        sa.Column("metadata", postgresql.JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("ip", sa.String(64)),
        sa.Column("user_agent", sa.Text),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "tipo IN ('pageview','click','conversion')", name="ck_eventos_tipo"
        ),
        schema="tracking",
    )
    op.create_index("ix_eventos_created_at", "eventos", ["created_at"], schema="tracking")
    op.create_index("ix_eventos_tipo", "eventos", ["tipo"], schema="tracking")
    op.create_index("ix_eventos_campaign", "eventos", ["utm_campaign"], schema="tracking")
    op.create_index("ix_eventos_anon", "eventos", ["anon_id"], schema="tracking")


def downgrade() -> None:
    op.drop_index("ix_eventos_anon", table_name="eventos", schema="tracking")
    op.drop_index("ix_eventos_campaign", table_name="eventos", schema="tracking")
    op.drop_index("ix_eventos_tipo", table_name="eventos", schema="tracking")
    op.drop_index("ix_eventos_created_at", table_name="eventos", schema="tracking")
    op.drop_table("eventos", schema="tracking")

    op.drop_index("ix_utm_links_campaign", table_name="utm_links", schema="tracking")
    op.drop_table("utm_links", schema="tracking")

    op.execute("DROP SCHEMA IF EXISTS tracking")
