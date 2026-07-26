"""extend job posting with comprehensive hiring fields

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-16 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'b2c3d4e5f6g7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to job_postings table
    op.add_column('job_postings', sa.Column('industry', sa.String(100), nullable=True))
    op.add_column('job_postings', sa.Column('weekly_off', sa.String(20), nullable=True))
    op.add_column('job_postings', sa.Column('work_address', sa.String(255), nullable=True))
    op.add_column('job_postings', sa.Column('min_age', sa.Integer(), nullable=True))
    op.add_column('job_postings', sa.Column('max_age', sa.Integer(), nullable=True))
    op.add_column('job_postings', sa.Column('min_qualification', sa.String(100), nullable=True))
    op.add_column('job_postings', sa.Column('gender_preference', sa.String(20), nullable=True))
    op.add_column('job_postings', sa.Column(
        'required_skills',
        postgresql.JSONB(astext_type=sa.Text()),
        nullable=True,
        server_default=sa.text("'{}'::jsonb"),
    ))
    op.add_column('job_postings', sa.Column(
        'languages_required',
        postgresql.JSONB(astext_type=sa.Text()),
        nullable=True,
        server_default=sa.text("'{}'::jsonb"),
    ))
    op.add_column('job_postings', sa.Column(
        'benefits',
        postgresql.JSONB(astext_type=sa.Text()),
        nullable=True,
        server_default=sa.text("'{}'::jsonb"),
    ))
    op.add_column('job_postings', sa.Column(
        'documents_required',
        postgresql.JSONB(astext_type=sa.Text()),
        nullable=True,
        server_default=sa.text("'{}'::jsonb"),
    ))
    op.add_column('job_postings', sa.Column('joining_timeline', sa.String(50), nullable=True))
    op.add_column('job_postings', sa.Column('interview_mode', sa.String(50), nullable=True))
    op.add_column('job_postings', sa.Column('hiring_priority', sa.String(50), nullable=True))
    op.add_column('job_postings', sa.Column('assigned_recruiter_id', sa.Integer(), nullable=True))
    
    # Add foreign key for assigned_recruiter_id
    op.create_foreign_key(
        'job_postings_assigned_recruiter_id_fkey',
        'job_postings',
        'users',
        ['assigned_recruiter_id'],
        ['id'],
    )


def downgrade() -> None:
    # Remove columns in reverse order
    op.drop_constraint('job_postings_assigned_recruiter_id_fkey', 'job_postings', type_='foreignkey')
    op.drop_column('job_postings', 'assigned_recruiter_id')
    op.drop_column('job_postings', 'hiring_priority')
    op.drop_column('job_postings', 'interview_mode')
    op.drop_column('job_postings', 'joining_timeline')
    op.drop_column('job_postings', 'documents_required')
    op.drop_column('job_postings', 'benefits')
    op.drop_column('job_postings', 'languages_required')
    op.drop_column('job_postings', 'required_skills')
    op.drop_column('job_postings', 'gender_preference')
    op.drop_column('job_postings', 'min_qualification')
    op.drop_column('job_postings', 'max_age')
    op.drop_column('job_postings', 'min_age')
    op.drop_column('job_postings', 'work_address')
    op.drop_column('job_postings', 'weekly_off')
    op.drop_column('job_postings', 'industry')
