"""add kyc pipeline stage

Revision ID: m1n2o3p4q5r6
Revises: l1m2n3o4p5q6
Create Date: 2026-07-28 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op

revision: str = "m1n2o3p4q5r6"
down_revision: Union[str, None] = "l1m2n3o4p5q6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE interview_stage_configs SET order_index = order_index + 1 WHERE stage_type = 'placement'")
    op.execute(
        """
        INSERT INTO interview_stage_configs (name, stage_type, order_index, is_active, created_at, updated_at)
        SELECT 'KYC Validation', 'kyc', 4, true, now(), now()
        WHERE NOT EXISTS (
            SELECT 1 FROM interview_stage_configs WHERE stage_type = 'kyc'
        )
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM interview_stage_configs WHERE stage_type = 'kyc'")
    op.execute("UPDATE interview_stage_configs SET order_index = order_index - 1 WHERE stage_type = 'placement'")
