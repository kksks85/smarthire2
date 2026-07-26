from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.core.enums import KycStatus


class KycDocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    candidate_id: int
    application_id: Optional[int] = None
    document_type: str
    original_filename: Optional[str] = None
    status: KycStatus
    verified_by_id: Optional[int] = None
    verified_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    download_url: Optional[str] = None


class KycVerifyRequest(BaseModel):
    status: KycStatus
    rejection_reason: Optional[str] = None


class AadhaarVerifyRequest(BaseModel):
    aadhaar_number: str
    name: str
    dob: Optional[str] = None
    mobile: Optional[str] = None


class PANVerifyRequest(BaseModel):
    pan_number: str
    name: str
    dob: Optional[str] = None


class BankAccountVerifyRequest(BaseModel):
    account_number: str
    ifsc_code: str
    account_holder_name: str


class KycVerificationResponse(BaseModel):
    verified: bool
    provider: str
    verified_at: Optional[str] = None
    match_score: Optional[int] = None
    name_match: Optional[bool] = None
    error: Optional[str] = None
    note: Optional[str] = None
    # Additional fields based on verification type
    pan_status: Optional[str] = None
    account_exists: Optional[bool] = None
    bank_name: Optional[str] = None
    branch: Optional[str] = None


class KycVerifyRequest(BaseModel):
    status: KycStatus
    rejection_reason: Optional[str] = None
