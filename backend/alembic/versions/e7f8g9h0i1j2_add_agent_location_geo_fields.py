"""add location_name and city to agent_location_logs

Revision ID: e7f8g9h0i1j2
Revises: d6e7f8g9h0i1
Create Date: 2026-07-16 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7f8g9h0i1j2'
down_revision: Union[str, None] = 'd6e7f8g9h0i1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'agent_location_logs',
        sa.Column('location_name', sa.String(length=255), nullable=True),
    )
    op.add_column(
        'agent_location_logs',
        sa.Column('city', sa.String(length=120), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('agent_location_logs', 'city')
    op.drop_column('agent_location_logs', 'location_name')
