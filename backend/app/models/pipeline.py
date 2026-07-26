from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import ApplicationStatus, StageOutcome, StageType
from app.db.session import Base
from app.models.mixins import TimestampMixin


class ScreeningQuestion(Base, TimestampMixin):
    """Admin-configured screening questions (10-15 preset per the interview flow)."""

    __tablename__ = "screening_questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(120))  # trade-specific or general
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class InterviewStageConfig(Base, TimestampMixin):
    """Admin-configurable ordered interview stages."""

    __tablename__ = "interview_stage_configs"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    stage_type: Mapped[StageType] = mapped_column(String(32), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Application(Base, TimestampMixin):
    """A candidate assigned to a job posting, moving through the pipeline."""

    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"), nullable=False)
    job_id: Mapped[int] = mapped_column(ForeignKey("job_postings.id"), nullable=False)
    assigned_recruiter_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    assigned_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))

    status: Mapped[ApplicationStatus] = mapped_column(
        String(20), default=ApplicationStatus.ASSIGNED, nullable=False, index=True
    )
    current_stage_type: Mapped[StageType] = mapped_column(
        String(32), default=StageType.SCREENING, nullable=False
    )

    evaluations: Mapped[list["StageEvaluation"]] = relationship(
        back_populates="application", cascade="all, delete-orphan"
    )


class StageEvaluation(Base, TimestampMixin):
    __tablename__ = "stage_evaluations"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), nullable=False)
    stage_type: Mapped[StageType] = mapped_column(String(32), nullable=False)
    outcome: Mapped[StageOutcome] = mapped_column(
        String(20), default=StageOutcome.PENDING, nullable=False
    )
    score: Mapped[Optional[int]] = mapped_column(Integer)  # 0-100
    remarks: Mapped[Optional[str]] = mapped_column(Text)
    evaluated_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    evaluated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    application: Mapped["Application"] = relationship(back_populates="evaluations")
