from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class InstitutionBase(BaseModel):
    name: str
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    address: Optional[str] = None


class InstitutionCreate(InstitutionBase):
    pass


class InstitutionOut(InstitutionBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    is_active: bool


class InstitutionUploadLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    institution_id: int
    registered_by_id: int
    filename: str
    file_type: str
    total_rows: int
    created_count: int
    skipped_count: int
    status: str
    errors: Optional[dict[str, Any]] = None
    created_at: datetime


class InstitutionUploadSummary(BaseModel):
    created: int
    skipped: int
    errors: list[str]


class EmployerBase(BaseModel):
    company_name: str
    industry: Optional[str] = None
    company_type: Optional[str] = None  # Private, Public, Government, MNC, Startup
    gst_number: Optional[str] = None
    website: Optional[str] = None
    
    # Legacy single contact fields (for backward compatibility)
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    address: Optional[str] = None
    
    # New structured data
    locations: Optional[dict[str, Any]] = None
    contacts: Optional[dict[str, Any]] = None
    
    # Employer-specific mandatory candidate fields/documents
    required_candidate_fields: Optional[dict[str, Any]] = None


class EmployerCreate(EmployerBase):
    pass


class EmployerOut(EmployerBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    is_active: bool
