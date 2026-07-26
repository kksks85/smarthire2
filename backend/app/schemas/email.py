from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, EmailStr, Field, SecretStr


# ---------- EmailAccount ----------

class EmailAccountBase(BaseModel):
    name: str
    from_address: EmailStr
    from_display_name: Optional[str] = None

    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_use_tls: bool = True
    smtp_use_ssl: bool = False

    imap_host: Optional[str] = None
    imap_port: Optional[int] = None
    imap_username: Optional[str] = None
    imap_use_ssl: bool = True
    imap_folder: str = "INBOX"

    is_default_outbound: bool = False
    is_active: bool = True


class EmailAccountCreate(EmailAccountBase):
    smtp_password: Optional[SecretStr] = None
    imap_password: Optional[SecretStr] = None


class EmailAccountUpdate(BaseModel):
    name: Optional[str] = None
    from_address: Optional[EmailStr] = None
    from_display_name: Optional[str] = None

    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[SecretStr] = None
    smtp_use_tls: Optional[bool] = None
    smtp_use_ssl: Optional[bool] = None

    imap_host: Optional[str] = None
    imap_port: Optional[int] = None
    imap_username: Optional[str] = None
    imap_password: Optional[SecretStr] = None
    imap_use_ssl: Optional[bool] = None
    imap_folder: Optional[str] = None

    is_default_outbound: Optional[bool] = None
    is_active: Optional[bool] = None


class EmailAccountOut(EmailAccountBase):
    id: int
    has_smtp_password: bool = False
    has_imap_password: bool = False
    last_polled_at: Optional[datetime] = None
    last_poll_error: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EmailAccountTestResult(BaseModel):
    smtp_ok: bool
    smtp_error: Optional[str] = None
    imap_ok: bool
    imap_error: Optional[str] = None


# ---------- EmailTemplate ----------

class EmailTemplateBase(BaseModel):
    name: str
    description: Optional[str] = None
    subject: str
    body_html: Optional[str] = None
    body_text: Optional[str] = None
    merge_context: str = "none"
    category: str = "transactional"
    is_active: bool = True


class EmailTemplateCreate(EmailTemplateBase):
    pass


class EmailTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    subject: Optional[str] = None
    body_html: Optional[str] = None
    body_text: Optional[str] = None
    merge_context: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None


class EmailTemplateOut(EmailTemplateBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EmailTemplatePreviewRequest(BaseModel):
    subject: str
    body_html: Optional[str] = None
    body_text: Optional[str] = None
    merge_context: str = "none"
    # Optional entity to render against. If omitted, sample data is used.
    entity_id: Optional[int] = None


class EmailTemplatePreviewResponse(BaseModel):
    subject: str
    body_html: Optional[str] = None
    body_text: Optional[str] = None
    context_used: dict[str, Any]


class MergeField(BaseModel):
    token: str  # e.g. "candidate.full_name"
    label: str  # e.g. "Full Name"


class MergeContextFields(BaseModel):
    context: str
    label: str
    fields: list[MergeField]


# ---------- EmailRule ----------

class EmailRuleBase(BaseModel):
    name: str
    direction: str = Field(..., pattern="^(inbound|outbound)$")
    is_active: bool = True
    priority: int = 100
    trigger_event: Optional[str] = None
    match_conditions: Optional[dict[str, Any]] = None
    action_type: str
    action_params: Optional[dict[str, Any]] = None
    template_id: Optional[int] = None
    account_id: Optional[int] = None


class EmailRuleCreate(EmailRuleBase):
    pass


class EmailRuleUpdate(BaseModel):
    name: Optional[str] = None
    direction: Optional[str] = Field(None, pattern="^(inbound|outbound)$")
    is_active: Optional[bool] = None
    priority: Optional[int] = None
    trigger_event: Optional[str] = None
    match_conditions: Optional[dict[str, Any]] = None
    action_type: Optional[str] = None
    action_params: Optional[dict[str, Any]] = None
    template_id: Optional[int] = None
    account_id: Optional[int] = None


class EmailRuleOut(EmailRuleBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ---------- EmailMessage ----------

class EmailComposeRequest(BaseModel):
    account_id: Optional[int] = None  # default outbound if omitted
    to_addresses: list[EmailStr]
    cc_addresses: list[EmailStr] = []
    bcc_addresses: list[EmailStr] = []
    subject: str
    body_html: Optional[str] = None
    body_text: Optional[str] = None
    related_candidate_id: Optional[int] = None
    related_application_id: Optional[int] = None
    related_job_id: Optional[int] = None


class EmailFromTemplateRequest(BaseModel):
    template_id: int
    account_id: Optional[int] = None
    to_addresses: list[EmailStr]
    cc_addresses: list[EmailStr] = []
    bcc_addresses: list[EmailStr] = []
    # ID of the entity matching the template's merge_context (candidate id, job id, etc.)
    entity_id: Optional[int] = None
    related_candidate_id: Optional[int] = None
    related_application_id: Optional[int] = None
    related_job_id: Optional[int] = None


class EmailAttachmentOut(BaseModel):
    id: int
    original_filename: str
    content_type: Optional[str] = None
    size_bytes: Optional[int] = None

    class Config:
        from_attributes = True


class EmailMessageOut(BaseModel):
    id: int
    direction: str
    account_id: Optional[int] = None
    template_id: Optional[int] = None
    rule_id: Optional[int] = None
    message_id: Optional[str] = None
    thread_id: Optional[str] = None
    from_address: Optional[str] = None
    from_name: Optional[str] = None
    to_addresses: Optional[list[str]] = None
    cc_addresses: Optional[list[str]] = None
    bcc_addresses: Optional[list[str]] = None
    subject: Optional[str] = None
    snippet: Optional[str] = None
    status: str
    error_detail: Optional[str] = None
    related_candidate_id: Optional[int] = None
    related_application_id: Optional[int] = None
    related_job_id: Optional[int] = None
    sent_at: Optional[datetime] = None
    received_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    attachment_count: int = 0

    class Config:
        from_attributes = True


class EmailMessageDetail(EmailMessageOut):
    body_html: Optional[str] = None
    body_text: Optional[str] = None
    attachments: list[EmailAttachmentOut] = []
