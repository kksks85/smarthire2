from __future__ import annotations

import enum
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.mixins import TimestampMixin


class EmailDirection(str, enum.Enum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class EmailStatus(str, enum.Enum):
    QUEUED = "queued"
    SENT = "sent"
    FAILED = "failed"
    RECEIVED = "received"
    BOUNCED = "bounced"


class EmailMergeContext(str, enum.Enum):
    NONE = "none"
    CANDIDATE = "candidate"
    JOB = "job"
    EMPLOYER = "employer"
    APPLICATION = "application"
    USER = "user"


class EmailAccount(Base, TimestampMixin):
    """A mailbox: one SMTP outbound + one IMAP inbound pair."""

    __tablename__ = "email_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    from_address: Mapped[str] = mapped_column(String(255), nullable=False)
    from_display_name: Mapped[Optional[str]] = mapped_column(String(120))

    # SMTP (outbound)
    smtp_host: Mapped[Optional[str]] = mapped_column(String(255))
    smtp_port: Mapped[Optional[int]] = mapped_column(Integer)
    smtp_username: Mapped[Optional[str]] = mapped_column(String(255))
    smtp_password_enc: Mapped[Optional[str]] = mapped_column(Text)
    smtp_use_tls: Mapped[bool] = mapped_column(Boolean, default=True)
    smtp_use_ssl: Mapped[bool] = mapped_column(Boolean, default=False)

    # IMAP (inbound)
    imap_host: Mapped[Optional[str]] = mapped_column(String(255))
    imap_port: Mapped[Optional[int]] = mapped_column(Integer)
    imap_username: Mapped[Optional[str]] = mapped_column(String(255))
    imap_password_enc: Mapped[Optional[str]] = mapped_column(Text)
    imap_use_ssl: Mapped[bool] = mapped_column(Boolean, default=True)
    imap_folder: Mapped[str] = mapped_column(String(120), default="INBOX")

    is_default_outbound: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    last_polled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_poll_error: Mapped[Optional[str]] = mapped_column(Text)

    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))


class EmailTemplate(Base, TimestampMixin):
    """Named, reusable email template rendered with Jinja2 against a merge context."""

    __tablename__ = "email_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(500))
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    body_html: Mapped[Optional[str]] = mapped_column(Text)
    body_text: Mapped[Optional[str]] = mapped_column(Text)
    merge_context: Mapped[str] = mapped_column(
        String(32), default=EmailMergeContext.NONE.value, nullable=False
    )
    category: Mapped[str] = mapped_column(String(40), default="transactional")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))


class EmailRule(Base, TimestampMixin):
    """Inbound routing / outbound trigger automation rule."""

    __tablename__ = "email_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    direction: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    priority: Mapped[int] = mapped_column(Integer, default=100)

    # Outbound: which app event fires this rule
    trigger_event: Mapped[Optional[str]] = mapped_column(String(80), index=True)

    # Inbound: JSON dict of match conditions
    #   { from_contains: str, subject_contains: str, has_attachment: bool, to_contains: str }
    match_conditions: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, default=dict)

    # Action: send_template | forward_to | tag_as | create_lead | auto_reply
    action_type: Mapped[str] = mapped_column(String(40), nullable=False)
    action_params: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, default=dict)

    template_id: Mapped[Optional[int]] = mapped_column(ForeignKey("email_templates.id"))
    account_id: Mapped[Optional[int]] = mapped_column(ForeignKey("email_accounts.id"))

    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))


class EmailMessage(Base, TimestampMixin):
    """Persistent log of every email that flowed through the system."""

    __tablename__ = "email_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    direction: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    account_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("email_accounts.id"), index=True
    )
    template_id: Mapped[Optional[int]] = mapped_column(ForeignKey("email_templates.id"))
    rule_id: Mapped[Optional[int]] = mapped_column(ForeignKey("email_rules.id"))

    # RFC-822 message-id header, if known
    message_id: Mapped[Optional[str]] = mapped_column(String(500), index=True)
    thread_id: Mapped[Optional[str]] = mapped_column(String(500), index=True)

    from_address: Mapped[Optional[str]] = mapped_column(String(255))
    from_name: Mapped[Optional[str]] = mapped_column(String(255))
    to_addresses: Mapped[Optional[list[str]]] = mapped_column(JSONB, default=list)
    cc_addresses: Mapped[Optional[list[str]]] = mapped_column(JSONB, default=list)
    bcc_addresses: Mapped[Optional[list[str]]] = mapped_column(JSONB, default=list)

    subject: Mapped[Optional[str]] = mapped_column(String(1000))
    body_html: Mapped[Optional[str]] = mapped_column(Text)
    body_text: Mapped[Optional[str]] = mapped_column(Text)
    snippet: Mapped[Optional[str]] = mapped_column(String(500))

    status: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    error_detail: Mapped[Optional[str]] = mapped_column(Text)

    related_candidate_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("candidates.id"), index=True
    )
    related_application_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("applications.id"), index=True
    )
    related_job_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("job_postings.id"), index=True
    )

    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    received_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))

    attachments: Mapped[list["EmailAttachment"]] = relationship(
        back_populates="message", cascade="all, delete-orphan"
    )


class EmailAttachment(Base, TimestampMixin):
    __tablename__ = "email_attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    message_id: Mapped[int] = mapped_column(
        ForeignKey("email_messages.id", ondelete="CASCADE"), nullable=False, index=True
    )
    file_key: Mapped[str] = mapped_column(String(500), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[Optional[str]] = mapped_column(String(120))
    size_bytes: Mapped[Optional[int]] = mapped_column(Integer)

    message: Mapped["EmailMessage"] = relationship(back_populates="attachments")
