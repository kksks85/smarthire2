from __future__ import annotations

from datetime import date
from typing import Any, Optional

from sqlalchemy import Date, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import CandidateSource, CandidateStatus
from app.db.session import Base
from app.models.mixins import TimestampMixin


class Candidate(Base, TimestampMixin):
    """A blue-collar worker profile in the Candidate Data Bank.

    PII fields (phone, email, aadhaar_last4, address) are masked by default in
    API responses; unmasking is only allowed via the audited reveal endpoint.
    """

    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(primary_key=True)

    full_name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    gender: Mapped[Optional[str]] = mapped_column(String(20))
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date)

    # --- PII (masked by default) ---
    phone: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255))
    address: Mapped[Optional[str]] = mapped_column(Text)
    aadhaar_last4: Mapped[Optional[str]] = mapped_column(String(4))

    # --- Location ---
    city: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    pincode: Mapped[Optional[str]] = mapped_column(String(10))

    # --- Blue-collar profile ---
    primary_trade: Mapped[Optional[str]] = mapped_column(String(120), index=True)
    experience_years: Mapped[Optional[int]] = mapped_column(Integer, default=0)
    education_level: Mapped[Optional[str]] = mapped_column(String(80))
    certification: Mapped[Optional[str]] = mapped_column(String(120))
    languages: Mapped[Optional[str]] = mapped_column(String(255))  # comma-separated
    expected_salary: Mapped[Optional[int]] = mapped_column(Integer)  # monthly INR
    has_driving_license: Mapped[bool] = mapped_column(default=False)
    willing_to_relocate: Mapped[bool] = mapped_column(default=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    # --- Extended structured profile (comprehensive registration data) ---
    # Holds sections 1-11 fields that don't have dedicated columns:
    # alternate_phone, marital_status, father_name, district, job_preferences,
    # work_experience, skills[], documents, languages_known[], additional_info,
    # emergency_contact, declaration_accepted, etc.
    profile_data: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, default=dict)

    # --- Provenance ---
    source: Mapped[CandidateSource] = mapped_column(String(32), nullable=False)
    status: Mapped[CandidateStatus] = mapped_column(
        String(20), default=CandidateStatus.NEW, nullable=False
    )
    institution_id: Mapped[Optional[int]] = mapped_column(ForeignKey("institutions.id"))
    registered_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    field_drive_id: Mapped[Optional[int]] = mapped_column(ForeignKey("field_drives.id"))

    field_drive: Mapped[Optional["FieldDrive"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        back_populates="candidates"
    )
