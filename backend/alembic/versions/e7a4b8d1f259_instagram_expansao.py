"""instagram: expansão — stories, hashtags, hourly_snapshots, reels columns

Revision ID: e7a4b8d1f259
Revises: d6f3a9c4e842
Create Date: 2026-05-17 16:00:00.000000

Adiciona suporte pra Stories (1 tabela), extração de hashtags (1 tabela),
snapshots horários pra cálculo de velocidade de viralização (1 tabela), e
colunas extras de Reels em instagram_posts (plays, clips_replays_count).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "e7a4b8d1f259"
down_revision: Union[str, None] = "d6f3a9c4e842"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ============================================================
    # mkt.instagram_stories — Stories ativos (expiram em 24h)
    # ============================================================
    op.create_table(
        "instagram_stories",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("ig_user_id", sa.String(length=64), nullable=False),
        sa.Column("story_id", sa.String(length=64), nullable=False),
        sa.Column("media_type", sa.String(length=32), nullable=False),
        sa.Column("thumbnail_url", sa.Text(), nullable=True),
        sa.Column("media_url", sa.Text(), nullable=True),
        sa.Column("permalink", sa.Text(), nullable=True),
        sa.Column(
            "timestamp_publicacao", sa.DateTime(timezone=True), nullable=False
        ),
        # Métricas snapshot
        sa.Column("reach", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("replies", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "taps_forward", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column(
            "taps_back", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column("exits", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "swipe_forward",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("retencao_pct", sa.Numeric(5, 2), nullable=True),
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
        sa.UniqueConstraint("story_id", name="uq_ig_stories"),
        schema="mkt",
    )
    op.create_index(
        "ix_ig_stories_data",
        "instagram_stories",
        [sa.text("timestamp_publicacao DESC")],
        schema="mkt",
    )

    # ============================================================
    # mkt.instagram_post_hashtags — hashtags extraídas das captions
    # ============================================================
    op.create_table(
        "instagram_post_hashtags",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("media_id", sa.String(length=64), nullable=False),
        sa.Column("hashtag", sa.String(length=128), nullable=False),
        sa.Column("posicao", sa.Integer(), nullable=False),
        sa.Column(
            "sincronizado_em",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("media_id", "hashtag", name="uq_ig_post_hashtag"),
        schema="mkt",
    )
    op.create_index(
        "ix_ig_hashtag",
        "instagram_post_hashtags",
        ["hashtag"],
        schema="mkt",
    )

    # ============================================================
    # mkt.instagram_post_hourly_snapshots — snapshots horários pra
    # calcular velocidade de viralização (1h/6h/24h/48h após o post)
    # ============================================================
    op.create_table(
        "instagram_post_hourly_snapshots",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("media_id", sa.String(length=64), nullable=False),
        sa.Column("snapshot_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "horas_pos_publicacao",
            sa.Integer(),
            nullable=False,
            comment="horas desde timestamp_publicacao do post",
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
        sa.UniqueConstraint(
            "media_id", "snapshot_em", name="uq_ig_post_hourly_snap"
        ),
        schema="mkt",
    )
    op.create_index(
        "ix_ig_hourly_snap_media",
        "instagram_post_hourly_snapshots",
        ["media_id", sa.text("snapshot_em")],
        schema="mkt",
    )

    # ============================================================
    # ALTER mkt.instagram_posts: colunas extras pra Reels
    # ============================================================
    with op.batch_alter_table("instagram_posts", schema="mkt") as batch:
        batch.add_column(
            sa.Column(
                "plays",
                sa.Integer(),
                nullable=False,
                server_default=sa.text("0"),
            )
        )
        batch.add_column(
            sa.Column(
                "clips_replays_count",
                sa.Integer(),
                nullable=False,
                server_default=sa.text("0"),
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("instagram_posts", schema="mkt") as batch:
        batch.drop_column("clips_replays_count")
        batch.drop_column("plays")

    op.drop_index(
        "ix_ig_hourly_snap_media",
        table_name="instagram_post_hourly_snapshots",
        schema="mkt",
    )
    op.drop_table("instagram_post_hourly_snapshots", schema="mkt")
    op.drop_index(
        "ix_ig_hashtag", table_name="instagram_post_hashtags", schema="mkt"
    )
    op.drop_table("instagram_post_hashtags", schema="mkt")
    op.drop_index("ix_ig_stories_data", table_name="instagram_stories", schema="mkt")
    op.drop_table("instagram_stories", schema="mkt")
