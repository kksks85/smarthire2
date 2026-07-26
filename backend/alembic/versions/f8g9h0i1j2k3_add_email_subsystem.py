"""add email subsystem

Revision ID: f8g9h0i1j2k3
Revises: e7f8g9h0i1j2
Create Date: 2026-07-16 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'f8g9h0i1j2k3'
down_revision: Union[str, None] = 'e7f8g9h0i1j2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # email_accounts
    op.create_table(
        'email_accounts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('from_address', sa.String(length=255), nullable=False),
        sa.Column('from_display_name', sa.String(length=120), nullable=True),
        sa.Column('smtp_host', sa.String(length=255), nullable=True),
        sa.Column('smtp_port', sa.Integer(), nullable=True),
        sa.Column('smtp_username', sa.String(length=255), nullable=True),
        sa.Column('smtp_password_enc', sa.Text(), nullable=True),
        sa.Column('smtp_use_tls', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('smtp_use_ssl', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('imap_host', sa.String(length=255), nullable=True),
        sa.Column('imap_port', sa.Integer(), nullable=True),
        sa.Column('imap_username', sa.String(length=255), nullable=True),
        sa.Column('imap_password_enc', sa.Text(), nullable=True),
        sa.Column('imap_use_ssl', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('imap_folder', sa.String(length=120), nullable=False, server_default='INBOX'),
        sa.Column('is_default_outbound', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('last_polled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_poll_error', sa.Text(), nullable=True),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    # email_templates
    op.create_table(
        'email_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('subject', sa.String(length=500), nullable=False),
        sa.Column('body_html', sa.Text(), nullable=True),
        sa.Column('body_text', sa.Text(), nullable=True),
        sa.Column('merge_context', sa.String(length=32), nullable=False, server_default='none'),
        sa.Column('category', sa.String(length=40), nullable=False, server_default='transactional'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_email_templates_name', 'email_templates', ['name'])

    # email_rules
    op.create_table(
        'email_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('direction', sa.String(length=16), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('priority', sa.Integer(), nullable=False, server_default='100'),
        sa.Column('trigger_event', sa.String(length=80), nullable=True),
        sa.Column('match_conditions', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=True),
        sa.Column('action_type', sa.String(length=40), nullable=False),
        sa.Column('action_params', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=True),
        sa.Column('template_id', sa.Integer(), nullable=True),
        sa.Column('account_id', sa.Integer(), nullable=True),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['template_id'], ['email_templates.id']),
        sa.ForeignKeyConstraint(['account_id'], ['email_accounts.id']),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_email_rules_direction', 'email_rules', ['direction'])
    op.create_index('ix_email_rules_trigger_event', 'email_rules', ['trigger_event'])

    # email_messages
    op.create_table(
        'email_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('direction', sa.String(length=16), nullable=False),
        sa.Column('account_id', sa.Integer(), nullable=True),
        sa.Column('template_id', sa.Integer(), nullable=True),
        sa.Column('rule_id', sa.Integer(), nullable=True),
        sa.Column('message_id', sa.String(length=500), nullable=True),
        sa.Column('thread_id', sa.String(length=500), nullable=True),
        sa.Column('from_address', sa.String(length=255), nullable=True),
        sa.Column('from_name', sa.String(length=255), nullable=True),
        sa.Column('to_addresses', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=True),
        sa.Column('cc_addresses', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=True),
        sa.Column('bcc_addresses', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=True),
        sa.Column('subject', sa.String(length=1000), nullable=True),
        sa.Column('body_html', sa.Text(), nullable=True),
        sa.Column('body_text', sa.Text(), nullable=True),
        sa.Column('snippet', sa.String(length=500), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('error_detail', sa.Text(), nullable=True),
        sa.Column('related_candidate_id', sa.Integer(), nullable=True),
        sa.Column('related_application_id', sa.Integer(), nullable=True),
        sa.Column('related_job_id', sa.Integer(), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('received_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['account_id'], ['email_accounts.id']),
        sa.ForeignKeyConstraint(['template_id'], ['email_templates.id']),
        sa.ForeignKeyConstraint(['rule_id'], ['email_rules.id']),
        sa.ForeignKeyConstraint(['related_candidate_id'], ['candidates.id']),
        sa.ForeignKeyConstraint(['related_application_id'], ['applications.id']),
        sa.ForeignKeyConstraint(['related_job_id'], ['job_postings.id']),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_email_messages_direction', 'email_messages', ['direction'])
    op.create_index('ix_email_messages_status', 'email_messages', ['status'])
    op.create_index('ix_email_messages_account_id', 'email_messages', ['account_id'])
    op.create_index('ix_email_messages_message_id', 'email_messages', ['message_id'])
    op.create_index('ix_email_messages_thread_id', 'email_messages', ['thread_id'])
    op.create_index('ix_email_messages_related_candidate_id', 'email_messages', ['related_candidate_id'])
    op.create_index('ix_email_messages_related_application_id', 'email_messages', ['related_application_id'])
    op.create_index('ix_email_messages_related_job_id', 'email_messages', ['related_job_id'])

    # email_attachments
    op.create_table(
        'email_attachments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('message_id', sa.Integer(), nullable=False),
        sa.Column('file_key', sa.String(length=500), nullable=False),
        sa.Column('original_filename', sa.String(length=255), nullable=False),
        sa.Column('content_type', sa.String(length=120), nullable=True),
        sa.Column('size_bytes', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['message_id'], ['email_messages.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_email_attachments_message_id', 'email_attachments', ['message_id'])


def downgrade() -> None:
    op.drop_index('ix_email_attachments_message_id', table_name='email_attachments')
    op.drop_table('email_attachments')

    for ix in [
        'ix_email_messages_related_job_id',
        'ix_email_messages_related_application_id',
        'ix_email_messages_related_candidate_id',
        'ix_email_messages_thread_id',
        'ix_email_messages_message_id',
        'ix_email_messages_account_id',
        'ix_email_messages_status',
        'ix_email_messages_direction',
    ]:
        op.drop_index(ix, table_name='email_messages')
    op.drop_table('email_messages')

    for ix in ['ix_email_rules_trigger_event', 'ix_email_rules_direction']:
        op.drop_index(ix, table_name='email_rules')
    op.drop_table('email_rules')

    op.drop_index('ix_email_templates_name', table_name='email_templates')
    op.drop_table('email_templates')

    op.drop_table('email_accounts')
