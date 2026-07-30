from __future__ import annotations

from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.candidate import Candidate


class Institution(Base, TimestampMixin):
    """Training institutes / ITIs / colleges that bulk-upload candidates."""

    __tablename__ = "institutions"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    contact_person: Mapped[Optional[str]] = mapped_column(String(150))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[Optional[str]] = mapped_column(String(100))
    address: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(default=True)

    upload_logs: Mapped[list["InstitutionUploadLog"]] = relationship(
        back_populates="institution",
        cascade="all, delete-orphan",
        order_by="InstitutionUploadLog.created_at.desc()",
    )


class InstitutionUploadLog(Base, TimestampMixin):
    """Audit trail for candidate bulk uploads by an institution/placement officer."""

    __tablename__ = "institution_upload_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    institution_id: Mapped[int] = mapped_column(
        ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    registered_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(10), nullable=False)  # xlsx, csv
    total_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    skipped_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="success")  # success, partial, failed
    errors: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, default=dict)

    institution: Mapped["Institution"] = relationship(back_populates="upload_logs")


class Employer(Base, TimestampMixin):
    """Client companies where blue-collar workers are placed."""

    __tablename__ = "employers"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_name: Mapped[str] = mapped_column(String(200), nullable=False)
    industry: Mapped[Optional[str]] = mapped_column(String(120))
    company_type: Mapped[Optional[str]] = mapped_column(String(50))  # Private, Public, Government, MNC, Startup
    gst_number: Mapped[Optional[str]] = mapped_column(String(20))
    website: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Legacy single contact fields (deprecated but kept for backward compatibility)
    contact_person: Mapped[Optional[str]] = mapped_column(String(150))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[Optional[str]] = mapped_column(String(100))
    address: Mapped[Optional[str]] = mapped_column(Text)
    
    # New JSONB columns for multiple locations and contacts
    locations: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, default=dict)
    contacts: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, default=dict)
    
    # Employer-specific mandatory candidate fields/documents
    # Structure: { "fields": ["aadhaar_number", ...], "documents": ["aadhaar_doc", ...] }
    required_candidate_fields: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, default=dict)
    
    is_active: Mapped[bool] = mapped_column(default=True)
