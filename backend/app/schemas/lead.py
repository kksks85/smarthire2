from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict

from app.core.enums import LeadStatus


class InboundLeadPayload(BaseModel):
    """Generic inbound webhook payload (v1)."""

    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    trade: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    source: str = "inbound_webhook"
    extra: Optional[dict[str, Any]] = None


class LeadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    source: str
    source_detail: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    trade: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    status: LeadStatus
    candidate_id: Optional[int] = None
    created_at: datetime
