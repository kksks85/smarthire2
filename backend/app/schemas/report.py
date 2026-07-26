from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, EmailStr, Field


# ---------- Data-source registry ----------

class OperatorMeta(BaseModel):
    key: str
    label: str
    unary: bool = False
    multi: bool = False


class ColumnMeta(BaseModel):
    name: str
    label: str
    type: str
    filterable: bool = True
    group_by_ok: bool = True
    aggregate_ok: bool = False
    is_pii: bool = False
    operators: list[OperatorMeta] = []


class DataSourceMeta(BaseModel):
    key: str
    label: str
    description: str = ""
    columns: list[ColumnMeta] = []


# ---------- Report definition ----------

class ReportBase(BaseModel):
    name: str
    description: Optional[str] = None
    data_source: str
    filters: Optional[dict[str, Any]] = None
    columns: Optional[list[dict[str, Any]]] = None
    group_by: Optional[list[str]] = None
    order_by: Optional[list[dict[str, str]]] = None
    display_type: str = "table"
    display_options: Optional[dict[str, Any]] = None
    row_limit: int = 1000
    is_public: bool = False


class ReportCreate(ReportBase):
    pass


class ReportUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    data_source: Optional[str] = None
    filters: Optional[dict[str, Any]] = None
    columns: Optional[list[dict[str, Any]]] = None
    group_by: Optional[list[str]] = None
    order_by: Optional[list[dict[str, str]]] = None
    display_type: Optional[str] = None
    display_options: Optional[dict[str, Any]] = None
    row_limit: Optional[int] = None
    is_public: Optional[bool] = None


class ReportOut(ReportBase):
    id: int
    owner_id: int
    owner_name: Optional[str] = None
    can_edit: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReportRunResult(BaseModel):
    columns: list[dict[str, Any]]
    rows: list[dict[str, Any]]
    row_count: int
    truncated: bool
    display_type: str
    display_options: dict[str, Any] = {}


class ReportPreviewRequest(BaseModel):
    data_source: str
    filters: Optional[dict[str, Any]] = None
    columns: Optional[list[dict[str, Any]]] = None
    group_by: Optional[list[str]] = None
    order_by: Optional[list[dict[str, str]]] = None
    row_limit: int = 200
    display_type: str = "table"
    display_options: Optional[dict[str, Any]] = None


# ---------- Sharing ----------

class ReportShareCreate(BaseModel):
    principal_type: str = Field(..., pattern="^(user|role)$")
    principal_id: int
    permission: str = Field("view", pattern="^(view|edit)$")


class ReportShareOut(BaseModel):
    id: int
    report_id: int
    principal_type: str
    principal_id: int
    principal_label: Optional[str] = None
    permission: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ---------- Scheduling ----------

class ReportScheduleBase(BaseModel):
    cron_expr: str
    timezone: str = "UTC"
    format: str = Field("csv", pattern="^(csv|xlsx|inline_html)$")
    email_template_id: Optional[int] = None
    recipients_users: list[int] = []
    recipients_roles: list[str] = []
    recipients_emails: list[EmailStr] = []
    is_active: bool = True


class ReportScheduleCreate(ReportScheduleBase):
    pass


class ReportScheduleUpdate(BaseModel):
    cron_expr: Optional[str] = None
    timezone: Optional[str] = None
    format: Optional[str] = Field(None, pattern="^(csv|xlsx|inline_html)$")
    email_template_id: Optional[int] = None
    recipients_users: Optional[list[int]] = None
    recipients_roles: Optional[list[str]] = None
    recipients_emails: Optional[list[EmailStr]] = None
    is_active: Optional[bool] = None


class ReportScheduleOut(ReportScheduleBase):
    id: int
    report_id: int
    last_run_at: Optional[datetime] = None
    next_run_at: Optional[datetime] = None
    last_run_status: Optional[str] = None
    last_run_error: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
