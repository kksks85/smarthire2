"""add employer and job required candidate fields

Revision ID: d6e7f8g9h0i1
Revises: c5d6e7f8g9h0
Create Date: 2026-07-16 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd6e7f8g9h0i1'
down_revision: Union[str, None] = 'c5d6e7f8g9h0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'employers',
        sa.Column('required_candidate_fields', postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default='{}')
    )
    op.add_column(
        'job_postings',
        sa.Column('required_candidate_fields', postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default='{}')
    )


def downgrade() -> None:
    op.drop_column('job_postings', 'required_candidate_fields')
    op.drop_column('employers', 'required_candidate_fields')
