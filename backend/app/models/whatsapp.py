from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.mixins import TimestampMixin


class WhatsAppSettings(Base, TimestampMixin):
    __tablename__ = "whatsapp_settings"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    is_enabled: Mapped[bool] = mapped_column(default=False, nullable=False)
    phone_number_id: Mapped[Optional[str]] = mapped_column(String(128))
    graph_api_version: Mapped[str] = mapped_column(String(20), default="v21.0", nullable=False)
    template_name: Mapped[Optional[str]] = mapped_column(String(512))
    template_language: Mapped[str] = mapped_column(String(32), default="en", nullable=False)
    access_token_enc: Mapped[Optional[str]] = mapped_column(Text)


class WhatsAppCampaign(Base, TimestampMixin):
    __tablename__ = "whatsapp_campaigns"

    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("job_postings.id"), nullable=False, index=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    apply_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="queued", nullable=False, index=True)
    recipient_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sent_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    error_detail: Mapped[Optional[str]] = mapped_column(Text)


class WhatsAppCampaignRecipient(Base, TimestampMixin):
    __tablename__ = "whatsapp_campaign_recipients"
    __table_args__ = (
        UniqueConstraint("campaign_id", "candidate_id", name="uq_whatsapp_campaign_candidate"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("whatsapp_campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"), nullable=False, index=True)
    phone_snapshot: Mapped[str] = mapped_column(String(32), nullable=False)
    match_score: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="queued", nullable=False, index=True)
    provider_message_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    error_detail: Mapped[Optional[str]] = mapped_column(Text)