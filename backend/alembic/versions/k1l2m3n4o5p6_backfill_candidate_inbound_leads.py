"""backfill candidate inbound leads

Revision ID: k1l2m3n4o5p6
Revises: j1k2l3m4n5o6
Create Date: 2026-07-28 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op

revision: str = "k1l2m3n4o5p6"
down_revision: Union[str, None] = "j1k2l3m4n5o6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO lead_inbound (
            source, source_detail, raw_payload, full_name, phone, email, trade,
            city, state, status, candidate_id, created_at, updated_at
        )
        SELECT
            CASE c.source
                WHEN 'social_media' THEN 'Social Media'
                WHEN 'field_agent' THEN 'Field Agent'
                ELSE 'Registered from SmartHire application'
            END,
            CASE c.source
                WHEN 'social_media' THEN COALESCE(
                    CASE LOWER(c.profile_data->>'registration_channel')
                        WHEN 'facebook' THEN 'Facebook'
                        WHEN 'linkedin' THEN 'LinkedIn'
                    END,
                    c.profile_data->>'registration_channel',
                    'Social Media'
                )
                WHEN 'field_agent' THEN COALESCE(
                    CASE WHEN fd.latitude IS NOT NULL AND fd.longitude IS NOT NULL
                        THEN 'GPS: ' || fd.latitude::text || ', ' || fd.longitude::text
                    END,
                    CONCAT_WS(', ', fd.venue_name, fd.city, fd.state),
                    'Field agent registration'
                )
                WHEN 'website' THEN 'SmartHire website'
                ELSE 'SmartHire application'
            END,
            json_build_object('candidate_source', c.source, 'backfilled', true)::text,
            c.full_name, c.phone, c.email, c.primary_trade, c.city, c.state,
            'new', c.id, c.created_at, c.updated_at
        FROM candidates c
        LEFT JOIN field_drives fd ON fd.id = c.field_drive_id
        WHERE NOT EXISTS (
            SELECT 1 FROM lead_inbound lead WHERE lead.candidate_id = c.id
        )
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM lead_inbound
        WHERE raw_payload::jsonb->>'backfilled' = 'true'
        """
    )
