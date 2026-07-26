from __future__ import annotations

from datetime import date as date_type
from datetime import datetime
from typing import Optional

from sqlalchemy import Date, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import DriveSetupType, DriveStatus
from app.db.session import Base
from app.models.mixins import TimestampMixin


class FieldDrive(Base, TimestampMixin):
    """A field-agent registration camp/drive at a physical venue.

    Agents visit colleges, residential complexes, industrial parks, etc. and
    set up a temporary registration point (canopy, moving van, tent, ...).
    Each drive can generate a public QR code / link so candidates can
    self-register on the spot, tagged back to the agent and venue.
    """

    __tablename__ = "field_drives"

    id: Mapped[int] = mapped_column(primary_key=True)
    field_agent_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    venue_name: Mapped[str] = mapped_column(String(200), nullable=False)
    setup_type: Mapped[str] = mapped_column(
        String(24), default=DriveSetupType.OTHER.value, nullable=False
    )
    setup_type_other: Mapped[Optional[str]] = mapped_column(String(120))

    address: Mapped[Optional[str]] = mapped_column(Text)
    city: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    pincode: Mapped[Optional[str]] = mapped_column(String(10))
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)

    status: Mapped[str] = mapped_column(
        String(16), default=DriveStatus.ACTIVE.value, nullable=False, index=True
    )
    public_slug: Mapped[Optional[str]] = mapped_column(String(64), unique=True, index=True)

    start_date: Mapped[Optional[date_type]] = mapped_column(Date)
    end_date: Mapped[Optional[date_type]] = mapped_column(Date)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    candidates: Mapped[list["Candidate"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        back_populates="field_drive"
    )
