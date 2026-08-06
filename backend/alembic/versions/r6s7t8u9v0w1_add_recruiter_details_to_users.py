"""add recruiter details to users

Revision ID: r6s7t8u9v0w1
Revises: q5r6s7t8u9v0
Create Date: 2026-08-06 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'r6s7t8u9v0w1'
down_revision: Union[str, None] = 'q5r6s7t8u9v0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('recruiter_details', postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default='{}')
    )


def downgrade() -> None:
    op.drop_column('users', 'recruiter_details')
