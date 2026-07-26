"""extend employer model with locations and contacts

Revision ID: c5d6e7f8g9h0
Revises: b2c3d4e5f6g7
Create Date: 2026-07-16 19:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c5d6e7f8g9h0'
down_revision: Union[str, None] = 'b2c3d4e5f6g7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to employers table
    op.add_column('employers', sa.Column('company_type', sa.String(length=50), nullable=True))
    op.add_column('employers', sa.Column('website', sa.String(length=255), nullable=True))
    op.add_column('employers', sa.Column('locations', postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default='{}'))
    op.add_column('employers', sa.Column('contacts', postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default='{}'))


def downgrade() -> None:
    op.drop_column('employers', 'contacts')
    op.drop_column('employers', 'locations')
    op.drop_column('employers', 'website')
    op.drop_column('employers', 'company_type')
