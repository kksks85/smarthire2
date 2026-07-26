from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class FieldDriveBase(BaseModel):
    title: str
    venue_name: str
    setup_type: str = Field(
        "other", pattern="^(canopy|moving_van|table_desk|tent|kiosk|other)$"
    )
    setup_type_other: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notes: Optional[str] = None


class FieldDriveCreate(FieldDriveBase):
    pass


class FieldDriveUpdate(BaseModel):
    title: Optional[str] = None
    venue_name: Optional[str] = None
    setup_type: Optional[str] = Field(
        None, pattern="^(canopy|moving_van|table_desk|tent|kiosk|other)$"
    )
    setup_type_other: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    status: Optional[str] = Field(None, pattern="^(active|closed)$")
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notes: Optional[str] = None


class FieldDriveOut(FieldDriveBase):
    id: int
    field_agent_id: int
    field_agent_name: Optional[str] = None
    status: str
    public_slug: Optional[str] = None
    candidate_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FieldDriveShareKit(BaseModel):
    id: int
    public_slug: str
    registration_url: str
    qr_data_uri: str
    whatsapp_share_url: str


class PublicDriveInfo(BaseModel):
    title: str
    venue_name: str
    setup_type: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    field_agent_name: Optional[str] = None
    slug: str
