"""add recruitment lifecycle

Revision ID: l1m2n3o4p5q6
Revises: k1l2m3n4o5p6
Create Date: 2026-07-28 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "l1m2n3o4p5q6"
down_revision: Union[str, None] = "k1l2m3n4o5p6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "candidates",
        sa.Column("pool_status", sa.String(length=20), nullable=False, server_default="available"),
    )
    op.create_index("ix_candidates_pool_status", "candidates", ["pool_status"])

    op.add_column(
        "applications",
        sa.Column("contact_attempt_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("applications", sa.Column("candidate_interest", sa.Boolean(), nullable=True))
    op.add_column("applications", sa.Column("interest_recorded_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("applications", sa.Column("released_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("applications", sa.Column("release_reason", sa.Text(), nullable=True))

    op.create_table(
        "recruiter_contact_attempts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("application_id", sa.Integer(), nullable=False),
        sa.Column("recruiter_id", sa.Integer(), nullable=False),
        sa.Column("outcome", sa.String(length=32), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("attempted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"]),
        sa.ForeignKeyConstraint(["recruiter_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_recruiter_contact_attempts_application_id", "recruiter_contact_attempts", ["application_id"])

    op.create_table(
        "screening_responses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("application_id", sa.Integer(), nullable=False),
        sa.Column("question_id", sa.Integer(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("answered_by_id", sa.Integer(), nullable=False),
        sa.Column("answered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"]),
        sa.ForeignKeyConstraint(["question_id"], ["screening_questions.id"]),
        sa.ForeignKeyConstraint(["answered_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("application_id", "question_id", name="uq_screening_responses_application_question"),
    )
    op.create_index("ix_screening_responses_application_id", "screening_responses", ["application_id"])

    op.execute("UPDATE candidates SET pool_status = 'placed' WHERE status = 'placed'")
    op.execute(
        """
        UPDATE candidates SET pool_status = 'reserved'
        WHERE id IN (
            SELECT candidate_id FROM applications
            WHERE status NOT IN ('rejected', 'withdrawn', 'placed')
        )
        """
    )


def downgrade() -> None:
    op.drop_index("ix_screening_responses_application_id", table_name="screening_responses")
    op.drop_table("screening_responses")
    op.drop_index("ix_recruiter_contact_attempts_application_id", table_name="recruiter_contact_attempts")
    op.drop_table("recruiter_contact_attempts")
    op.drop_column("applications", "release_reason")
    op.drop_column("applications", "released_at")
    op.drop_column("applications", "interest_recorded_at")
    op.drop_column("applications", "candidate_interest")
    op.drop_column("applications", "contact_attempt_count")
    op.drop_index("ix_candidates_pool_status", table_name="candidates")
    op.drop_column("candidates", "pool_status")
