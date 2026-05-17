"""instagram: cria 4 tabelas pra integração Instagram Graph API

Revision ID: c5d2a8f3e731
Revises: b4c9f1e3a527
Create Date: 2026-05-17 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c5d2a8f3e731"
down_revision: Union[str, None] = "b4c9f1e3a527"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ============================================================
    # mkt.instagram_account_daily — snapshot diário do perfil + insights
    # ============================================================
    op.create_table(
        "instagram_account_daily",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("ig_user_id", sa.String(length=64), nullable=False),
        sa.Column("data", sa.Date(), nullable=False),
        sa.Column("username", sa.String(length=64), nullable=True),
        sa.Column(
            "followers_count", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column(
            "follows_count", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column(
            "media_count", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column("reach", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "profile_views", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column(
            "website_clicks", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column(
            "accounts_engaged",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "total_interactions",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("likes", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "comments", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column("shares", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("saves", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("replies", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "follows_gained",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("raw_payload", postgresql.JSONB(), nullable=True),
        sa.Column(
            "sincronizado_em",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("ig_user_id", "data", name="uq_ig_account_daily"),
        schema="mkt",
    )
    op.create_index(
        "ix_ig_account_data",
        "instagram_account_daily",
        [sa.text("data DESC")],
        schema="mkt",
    )

    # ============================================================
    # mkt.instagram_posts — 1 linha por mídia (post/reel/carrossel)
    # ============================================================
    op.create_table(
        "instagram_posts",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("ig_user_id", sa.String(length=64), nullable=False),
        sa.Column("media_id", sa.String(length=64), nullable=False),
        sa.Column("media_type", sa.String(length=32), nullable=False),
        sa.Column("media_product_type", sa.String(length=32), nullable=True),
        sa.Column("caption", sa.Text(), nullable=True),
        sa.Column("permalink", sa.String(length=512), nullable=True),
        sa.Column("thumbnail_url", sa.String(length=1024), nullable=True),
        sa.Column("media_url", sa.String(length=1024), nullable=True),
        sa.Column(
            "timestamp_publicacao", sa.DateTime(timezone=True), nullable=False
        ),
        sa.Column("reach", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("views", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("likes", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "comments", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column("shares", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("saved", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "total_interactions",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "profile_visits", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column(
            "profile_activity",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("follows", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "ig_reels_video_view_total_time", sa.BigInteger(), nullable=True
        ),
        sa.Column("ig_reels_avg_watch_time", sa.Integer(), nullable=True),
        sa.Column("raw_payload", postgresql.JSONB(), nullable=True),
        sa.Column(
            "ultimo_snapshot_em",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "sincronizado_em",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("media_id", name="uq_ig_posts"),
        schema="mkt",
    )
    op.create_index(
        "ix_ig_posts_timestamp",
        "instagram_posts",
        [sa.text("timestamp_publicacao DESC")],
        schema="mkt",
    )
    op.create_index(
        "ix_ig_posts_type",
        "instagram_posts",
        ["media_type"],
        schema="mkt",
    )

    # ============================================================
    # mkt.instagram_post_snapshots — evolução de métricas por post
    # ============================================================
    op.create_table(
        "instagram_post_snapshots",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("media_id", sa.String(length=64), nullable=False),
        sa.Column("data", sa.Date(), nullable=False),
        sa.Column("reach", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("views", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("likes", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "comments", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column("shares", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("saved", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "total_interactions",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "profile_visits", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column("follows", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "sincronizado_em",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("media_id", "data", name="uq_ig_post_snapshots"),
        schema="mkt",
    )
    op.create_index(
        "ix_ig_post_snap_data",
        "instagram_post_snapshots",
        [sa.text("data DESC")],
        schema="mkt",
    )

    # ============================================================
    # mkt.instagram_audience — demografia (semanal)
    # ============================================================
    op.create_table(
        "instagram_audience",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("ig_user_id", sa.String(length=64), nullable=False),
        sa.Column("data", sa.Date(), nullable=False),
        sa.Column("breakdown", sa.String(length=32), nullable=False),
        sa.Column("chave", sa.String(length=128), nullable=False),
        sa.Column("valor", sa.Integer(), nullable=False),
        sa.Column(
            "sincronizado_em",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint(
            "ig_user_id", "data", "breakdown", "chave", name="uq_ig_audience"
        ),
        schema="mkt",
    )
    op.create_index(
        "ix_ig_audience_data",
        "instagram_audience",
        [sa.text("data DESC")],
        schema="mkt",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_ig_audience_data", table_name="instagram_audience", schema="mkt"
    )
    op.drop_table("instagram_audience", schema="mkt")
    op.drop_index(
        "ix_ig_post_snap_data",
        table_name="instagram_post_snapshots",
        schema="mkt",
    )
    op.drop_table("instagram_post_snapshots", schema="mkt")
    op.drop_index("ix_ig_posts_type", table_name="instagram_posts", schema="mkt")
    op.drop_index(
        "ix_ig_posts_timestamp", table_name="instagram_posts", schema="mkt"
    )
    op.drop_table("instagram_posts", schema="mkt")
    op.drop_index(
        "ix_ig_account_data",
        table_name="instagram_account_daily",
        schema="mkt",
    )
    op.drop_table("instagram_account_daily", schema="mkt")
