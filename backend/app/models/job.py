from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import ApprovalDecision, JobStatus
from app.db.session import Base
from app.models.mixins import TimestampMixin


class JobPosting(Base, TimestampMixin):
    __tablename__ = "job_postings"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    industry: Mapped[Optional[str]] = mapped_column(String(100))

    employer_id: Mapped[int] = mapped_column(ForeignKey("employers.id"), nullable=False)

    # Blue-collar job attributes
    employment_type: Mapped[Optional[str]] = mapped_column(String(40))
    shift_type: Mapped[Optional[str]] = mapped_column(String(20))
    weekly_off: Mapped[Optional[str]] = mapped_column(String(20))
    vacancies: Mapped[int] = mapped_column(Integer, default=1)
    salary_min: Mapped[Optional[int]] = mapped_column(Integer)  # monthly INR
    salary_max: Mapped[Optional[int]] = mapped_column(Integer)
    
    # Location
    work_address: Mapped[Optional[str]] = mapped_column(String(255))
    work_city: Mapped[Optional[str]] = mapped_column(String(100))
    work_state: Mapped[Optional[str]] = mapped_column(String(100))
    
    # Requirements
    min_experience_years: Mapped[int] = mapped_column(Integer, default=0)
    min_age: Mapped[Optional[int]] = mapped_column(Integer)
    max_age: Mapped[Optional[int]] = mapped_column(Integer)
    min_qualification: Mapped[Optional[str]] = mapped_column(String(100))
    gender_preference: Mapped[Optional[str]] = mapped_column(String(20))
    required_certification: Mapped[Optional[str]] = mapped_column(String(120))
    
    # Flexible fields in JSONB
    required_skills: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, default=dict)
    languages_required: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, default=dict)
    benefits: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, default=dict)
    documents_required: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, default=dict)
    
    # Inherited from employer at creation time: mandatory candidate fields/documents
    # Structure: { "fields": ["aadhaar_number", ...], "documents": ["aadhaar_doc", ...] }
    required_candidate_fields: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, default=dict)
    
    # Additional
    accommodation_provided: Mapped[bool] = mapped_column(default=False)
    joining_timeline: Mapped[Optional[str]] = mapped_column(String(50))
    interview_mode: Mapped[Optional[str]] = mapped_column(String(50))
    hiring_priority: Mapped[Optional[str]] = mapped_column(String(50))

    status: Mapped[JobStatus] = mapped_column(
        String(20), default=JobStatus.DRAFT, nullable=False, index=True
    )
    public_slug: Mapped[Optional[str]] = mapped_column(String(64), unique=True, index=True)
    qr_key: Mapped[Optional[str]] = mapped_column(String(255))
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    assigned_recruiter_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))

    approvals: Mapped[list["JobApproval"]] = relationship(
        back_populates="job", cascade="all, delete-orphan"
    )


class JobApproval(Base, TimestampMixin):
    __tablename__ = "job_approvals"

    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("job_postings.id"), nullable=False)
    approver_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    decision: Mapped[ApprovalDecision] = mapped_column(
        String(20), default=ApprovalDecision.PENDING, nullable=False
    )
    comments: Mapped[Optional[str]] = mapped_column(Text)
    decided_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    job: Mapped["JobPosting"] = relationship(back_populates="approvals")
