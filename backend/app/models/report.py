from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.mixins import TimestampMixin


class Report(Base, TimestampMixin):
    """Saved report definition. Results are computed live on view."""

    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    data_source: Mapped[str] = mapped_column(String(80), nullable=False, index=True)

    # Nested filter tree:
    # {"join": "and", "children": [{"field": "...", "op": "...", "value": ...}, ...]}
    filters: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, default=dict)

    # List of {"field": "...", "label": "...", "aggregate": "sum|count|..."}
    columns: Mapped[Optional[list[dict[str, Any]]]] = mapped_column(JSONB, default=list)

    group_by: Mapped[Optional[list[str]]] = mapped_column(JSONB, default=list)
    order_by: Mapped[Optional[list[dict[str, str]]]] = mapped_column(JSONB, default=list)

    # table | bar | line | pie | kpi | map | funnel
    display_type: Mapped[str] = mapped_column(String(24), default="table", nullable=False)

    # Chart-type-specific settings (x_axis, y_axis, kpi_metric, map_lat/lon, funnel_stage, ...)
    display_options: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, default=dict)

    row_limit: Mapped[int] = mapped_column(Integer, default=1000)

    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)

    shares: Mapped[list["ReportShare"]] = relationship(
        back_populates="report", cascade="all, delete-orphan"
    )
    schedules: Mapped[list["ReportSchedule"]] = relationship(
        back_populates="report", cascade="all, delete-orphan"
    )


class ReportShare(Base, TimestampMixin):
    """Sharing grant: report → user or role."""

    __tablename__ = "report_shares"

    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(
        ForeignKey("reports.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # user | role
    principal_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # For user: users.id. For role: roles.id.
    principal_id: Mapped[int] = mapped_column(Integer, nullable=False)
    # view | edit
    permission: Mapped[str] = mapped_column(String(20), default="view", nullable=False)

    report: Mapped["Report"] = relationship(back_populates="shares")


class ReportSchedule(Base, TimestampMixin):
    __tablename__ = "report_schedules"

    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(
        ForeignKey("reports.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # 5-field cron expression (min hour dom month dow)
    cron_expr: Mapped[str] = mapped_column(String(80), nullable=False)
    timezone: Mapped[str] = mapped_column(String(60), default="UTC")

    # csv | xlsx | inline_html
    format: Mapped[str] = mapped_column(String(20), default="csv")
    email_template_id: Mapped[Optional[int]] = mapped_column(ForeignKey("email_templates.id"))

    recipients_users: Mapped[Optional[list[int]]] = mapped_column(JSONB, default=list)
    recipients_roles: Mapped[Optional[list[str]]] = mapped_column(JSONB, default=list)
    recipients_emails: Mapped[Optional[list[str]]] = mapped_column(JSONB, default=list)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    next_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), index=True)
    last_run_status: Mapped[Optional[str]] = mapped_column(String(40))
    last_run_error: Mapped[Optional[str]] = mapped_column(Text)

    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))

    report: Mapped["Report"] = relationship(back_populates="schedules")
