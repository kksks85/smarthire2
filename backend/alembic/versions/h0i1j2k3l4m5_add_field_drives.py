"""add field drives (registration camps)

Revision ID: h0i1j2k3l4m5
Revises: g9h0i1j2k3l4
Create Date: 2026-07-16 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'h0i1j2k3l4m5'
down_revision: Union[str, None] = 'g9h0i1j2k3l4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'field_drives',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('field_agent_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('venue_name', sa.String(length=200), nullable=False),
        sa.Column('setup_type', sa.String(length=24), nullable=False, server_default='other'),
        sa.Column('setup_type_other', sa.String(length=120), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('state', sa.String(length=100), nullable=True),
        sa.Column('pincode', sa.String(length=10), nullable=True),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('status', sa.String(length=16), nullable=False, server_default='active'),
        sa.Column('public_slug', sa.String(length=64), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['field_agent_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_field_drives_field_agent_id', 'field_drives', ['field_agent_id'])
    op.create_index('ix_field_drives_city', 'field_drives', ['city'])
    op.create_index('ix_field_drives_state', 'field_drives', ['state'])
    op.create_index('ix_field_drives_status', 'field_drives', ['status'])
    op.create_index(
        'ix_field_drives_public_slug', 'field_drives', ['public_slug'], unique=True
    )

    op.add_column(
        'candidates',
        sa.Column('field_drive_id', sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        'fk_candidates_field_drive_id',
        'candidates',
        'field_drives',
        ['field_drive_id'],
        ['id'],
    )
    op.create_index(
        'ix_candidates_field_drive_id', 'candidates', ['field_drive_id']
    )


def downgrade() -> None:
    op.drop_index('ix_candidates_field_drive_id', table_name='candidates')
    op.drop_constraint('fk_candidates_field_drive_id', 'candidates', type_='foreignkey')
    op.drop_column('candidates', 'field_drive_id')

    op.drop_index('ix_field_drives_public_slug', table_name='field_drives')
    op.drop_index('ix_field_drives_status', table_name='field_drives')
    op.drop_index('ix_field_drives_state', table_name='field_drives')
    op.drop_index('ix_field_drives_city', table_name='field_drives')
    op.drop_index('ix_field_drives_field_agent_id', table_name='field_drives')
    op.drop_table('field_drives')
