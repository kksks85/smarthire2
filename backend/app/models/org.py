from __future__ import annotations

from typing import Any, Optional

from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.mixins import TimestampMixin


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
