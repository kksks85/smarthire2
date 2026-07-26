from __future__ import annotations

from typing import Optional

from sqlalchemy import Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import LocationEvent
from app.db.session import Base
from app.models.mixins import TimestampMixin


class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    entity_type: Mapped[Optional[str]] = mapped_column(String(80), index=True)
    entity_id: Mapped[Optional[int]] = mapped_column(index=True)
    detail: Mapped[Optional[str]] = mapped_column(Text)
    ip_address: Mapped[Optional[str]] = mapped_column(String(64))


class PiiAccessLog(Base, TimestampMixin):
    """Every unmask of candidate PII is recorded here (hard requirement)."""

    __tablename__ = "pii_access_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    candidate_id: Mapped[int] = mapped_column(
        ForeignKey("candidates.id"), nullable=False, index=True
    )
    fields_revealed: Mapped[str] = mapped_column(String(255), nullable=False)
    ip_address: Mapped[Optional[str]] = mapped_column(String(64))


class AgentLocationLog(Base, TimestampMixin):
    """GPS log for field-agent activity (registrations / check-ins / visits)."""

    __tablename__ = "agent_location_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    field_agent_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    candidate_id: Mapped[Optional[int]] = mapped_column(ForeignKey("candidates.id"))
    event_type: Mapped[LocationEvent] = mapped_column(
        String(32), default=LocationEvent.REGISTRATION, nullable=False
    )
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    accuracy_m: Mapped[Optional[float]] = mapped_column(Float)
    address_text: Mapped[Optional[str]] = mapped_column(Text)
    location_name: Mapped[Optional[str]] = mapped_column(String(255))
    city: Mapped[Optional[str]] = mapped_column(String(120))
