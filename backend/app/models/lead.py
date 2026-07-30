from __future__ import annotations

from typing import Optional

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import LeadStatus
from app.db.session import Base
from app.models.mixins import TimestampMixin


class LeadInbound(Base, TimestampMixin):
    """Raw inbound leads (generic webhook / website / social) before promotion."""

    __tablename__ = "lead_inbound"

    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(String(64), nullable=False)
    source_detail: Mapped[Optional[str]] = mapped_column(String(255))
    raw_payload: Mapped[Optional[str]] = mapped_column(Text)  # JSON string

    full_name: Mapped[Optional[str]] = mapped_column(String(150))
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    trade: Mapped[Optional[str]] = mapped_column(String(120))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[Optional[str]] = mapped_column(String(100))

    status: Mapped[LeadStatus] = mapped_column(
        String(20), default=LeadStatus.NEW, nullable=False, index=True
    )
    candidate_id: Mapped[Optional[int]] = mapped_column(ForeignKey("candidates.id"))
