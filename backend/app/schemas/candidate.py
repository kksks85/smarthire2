from datetime import date
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict

from app.core.enums import CandidateSource, CandidateStatus


class CandidateBase(BaseModel):
    full_name: str
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None
    aadhaar_last4: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    primary_trade: Optional[str] = None
    experience_years: Optional[int] = 0
    education_level: Optional[str] = None
    certification: Optional[str] = None
    languages: Optional[str] = None
    expected_salary: Optional[int] = None
    has_driving_license: bool = False
    willing_to_relocate: bool = False
    notes: Optional[str] = None
    profile_data: Optional[dict[str, Any]] = None


class CandidateCreate(CandidateBase):
    source: CandidateSource = CandidateSource.MANUAL
    institution_id: Optional[int] = None
    field_drive_id: Optional[int] = None


class CandidateUpdate(BaseModel):
    full_name: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    primary_trade: Optional[str] = None
    experience_years: Optional[int] = None
    education_level: Optional[str] = None
    certification: Optional[str] = None
    languages: Optional[str] = None
    expected_salary: Optional[int] = None
    has_driving_license: Optional[bool] = None
    willing_to_relocate: Optional[bool] = None
    notes: Optional[str] = None
    status: Optional[CandidateStatus] = None
    profile_data: Optional[dict[str, Any]] = None


class CandidateOut(BaseModel):
    """Candidate representation with PII masked by default."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    phone: Optional[str] = None  # masked unless revealed
    email: Optional[str] = None  # masked unless revealed
    address: Optional[str] = None  # masked unless revealed
    aadhaar_last4: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    primary_trade: Optional[str] = None
    experience_years: Optional[int] = None
    education_level: Optional[str] = None
    certification: Optional[str] = None
    languages: Optional[str] = None
    expected_salary: Optional[int] = None
    has_driving_license: bool = False
    willing_to_relocate: bool = False
    notes: Optional[str] = None
    profile_data: Optional[dict[str, Any]] = None
    source: CandidateSource
    status: CandidateStatus
    institution_id: Optional[int] = None
    field_drive_id: Optional[int] = None
    pii_masked: bool = True


class CandidatePii(BaseModel):
    """Unmasked PII returned by the audited reveal endpoint."""

    id: int
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None


class PublicRegistration(BaseModel):
    """Public self-registration via QR / website (no auth)."""

    full_name: str
    phone: str
    email: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    primary_trade: Optional[str] = None
    experience_years: Optional[int] = 0
    job_slug: Optional[str] = None
    drive_slug: Optional[str] = None
