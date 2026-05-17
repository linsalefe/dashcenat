"""instagram_posts: permalink/thumbnail_url/media_url → TEXT

Motivo: URLs do Instagram CDN (especialmente thumbnails/media com tokens de
assinatura) excedem 512/1024 chars e estouravam VARCHAR no upsert
(StringDataRightTruncationError), derrubando o sync inteiro.

Revision ID: d6f3a9c4e842
Revises: c5d2a8f3e731
Create Date: 2026-05-17 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "d6f3a9c4e842"
down_revision: Union[str, None] = "c5d2a8f3e731"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE mkt.instagram_posts
          ALTER COLUMN permalink TYPE TEXT,
          ALTER COLUMN thumbnail_url TYPE TEXT,
          ALTER COLUMN media_url TYPE TEXT
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE mkt.instagram_posts
          ALTER COLUMN permalink TYPE VARCHAR(512),
          ALTER COLUMN thumbnail_url TYPE VARCHAR(1024),
          ALTER COLUMN media_url TYPE VARCHAR(1024)
        """
    )
