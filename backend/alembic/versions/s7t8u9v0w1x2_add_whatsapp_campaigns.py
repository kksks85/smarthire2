"""add WhatsApp settings and campaign delivery records

Revision ID: s7t8u9v0w1x2
Revises: r6s7t8u9v0w1
Create Date: 2026-08-06 13:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "s7t8u9v0w1x2"
down_revision: Union[str, None] = "r6s7t8u9v0w1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "whatsapp_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("phone_number_id", sa.String(length=128)),
        sa.Column("graph_api_version", sa.String(length=20), nullable=False, server_default="v21.0"),
        sa.Column("template_name", sa.String(length=512)),
        sa.Column("template_language", sa.String(length=32), nullable=False, server_default="en"),
        sa.Column("access_token_enc", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "whatsapp_campaigns",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("job_id", sa.Integer(), nullable=False),
        sa.Column("created_by_id", sa.Integer(), nullable=False),
        sa.Column("apply_url", sa.String(length=1000), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="queued"),
        sa.Column("recipient_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sent_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("error_detail", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["job_id"], ["job_postings.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_whatsapp_campaigns_job_id", "whatsapp_campaigns", ["job_id"])
    op.create_index("ix_whatsapp_campaigns_status", "whatsapp_campaigns", ["status"])
    op.create_table(
        "whatsapp_campaign_recipients",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("campaign_id", sa.Integer(), nullable=False),
        sa.Column("candidate_id", sa.Integer(), nullable=False),
        sa.Column("phone_snapshot", sa.String(length=32), nullable=False),
        sa.Column("match_score", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="queued"),
        sa.Column("provider_message_id", sa.String(length=255)),
        sa.Column("sent_at", sa.DateTime(timezone=True)),
        sa.Column("error_detail", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"]),
        sa.ForeignKeyConstraint(["campaign_id"], ["whatsapp_campaigns.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("campaign_id", "candidate_id", name="uq_whatsapp_campaign_candidate"),
        sa.UniqueConstraint("provider_message_id"),
    )
    op.create_index("ix_whatsapp_campaign_recipients_campaign_id", "whatsapp_campaign_recipients", ["campaign_id"])
    op.create_index("ix_whatsapp_campaign_recipients_candidate_id", "whatsapp_campaign_recipients", ["candidate_id"])
    op.create_index("ix_whatsapp_campaign_recipients_status", "whatsapp_campaign_recipients", ["status"])


def downgrade() -> None:
    op.drop_table("whatsapp_campaign_recipients")
    op.drop_table("whatsapp_campaigns")
    op.drop_table("whatsapp_settings")