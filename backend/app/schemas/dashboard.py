from typing import Optional
from datetime import datetime

from pydantic import BaseModel

from app.core.enums import LocationEvent


class LocationLogCreate(BaseModel):
    candidate_id: Optional[int] = None
    event_type: LocationEvent = LocationEvent.REGISTRATION
    latitude: float
    longitude: float
    accuracy_m: Optional[float] = None
    address_text: Optional[str] = None
    location_name: Optional[str] = None
    city: Optional[str] = None


class LocationLogOut(BaseModel):
    id: int
    field_agent_id: int
    field_agent_name: Optional[str] = None
    employee_id: Optional[str] = None
    candidate_id: Optional[int] = None
    event_type: LocationEvent
    latitude: float
    longitude: float
    accuracy_m: Optional[float] = None
    address_text: Optional[str] = None
    location_name: Optional[str] = None
    city: Optional[str] = None
    created_at: Optional[datetime] = None


class KpiCard(BaseModel):
    label: str
    value: int
    hint: Optional[str] = None
    link: Optional[str] = None


class DashboardOut(BaseModel):
    role: str
    cards: list[KpiCard]
