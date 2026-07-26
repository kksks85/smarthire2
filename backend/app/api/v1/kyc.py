from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Form, HTTPException, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import require_roles
from app.core.enums import KycStatus, RoleName
from app.db.session import get_db
from app.integrations.storage import storage
from app.models.kyc import KycDocument
from app.models.user import User
from app.schemas.kyc import (
    AadhaarVerifyRequest,
    BankAccountVerifyRequest,
    KycDocumentOut,
    KycVerificationResponse,
    KycVerifyRequest,
    PANVerifyRequest,
)
from app.services.kyc_verification import kyc_service

router = APIRouter(prefix="/kyc", tags=["kyc"])

_STAFF = require_roles(RoleName.ADMIN, RoleName.MANAGER, RoleName.RECRUITER)
_VERIFIERS = require_roles(RoleName.ADMIN, RoleName.MANAGER, RoleName.RECRUITER)


def _serialize(doc: KycDocument) -> KycDocumentOut:
    out = KycDocumentOut.model_validate(doc)
    out.download_url = storage.presigned_url(doc.file_key)
    return out


@router.get("/candidate/{candidate_id}", response_model=list[KycDocumentOut])
def list_documents(
    candidate_id: int, db: Session = Depends(get_db), _: User = Depends(_STAFF)
):
    docs = db.scalars(
        select(KycDocument).where(KycDocument.candidate_id == candidate_id)
    ).all()
    return [_serialize(d) for d in docs]


@router.post("/candidate/{candidate_id}", response_model=KycDocumentOut, status_code=201)
async def upload_document(
    candidate_id: int,
    document_type: str = Form(...),
    application_id: int | None = Form(None),
    file: UploadFile = ...,
    db: Session = Depends(get_db),
    _: User = Depends(_STAFF),
):
    content = await file.read()
    key = storage.save(content, file.filename or "document", file.content_type)
    doc = KycDocument(
        candidate_id=candidate_id,
        application_id=application_id,
        document_type=document_type,
        file_key=key,
        original_filename=file.filename,
        content_type=file.content_type,
        status=KycStatus.SUBMITTED,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _serialize(doc)


@router.post("/{doc_id}/verify", response_model=KycDocumentOut)
def verify_document(
    doc_id: int,
    body: KycVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(_VERIFIERS),
):
    doc = db.get(KycDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if body.status not in (KycStatus.VERIFIED, KycStatus.REJECTED):
        raise HTTPException(status_code=400, detail="Status must be verified or rejected")

    doc.status = body.status
    doc.verified_by_id = current_user.id
    doc.verified_at = datetime.now(timezone.utc)
    doc.rejection_reason = body.rejection_reason if body.status == KycStatus.REJECTED else None
    db.commit()
    db.refresh(doc)
    return _serialize(doc)


@router.get("/file/{key}")
def download_local(key: str, _: User = Depends(_STAFF)):
    """Serve a locally-stored KYC file (dev mode only)."""
    if not settings.STORAGE_USE_LOCAL:
        raise HTTPException(status_code=404, detail="Not available")
    try:
        data = storage.read_local(key)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    return Response(content=data, media_type="application/octet-stream")


@router.post("/verify/aadhaar", response_model=KycVerificationResponse)
async def verify_aadhaar(
    body: AadhaarVerifyRequest,
    db: Session = Depends(get_db),
    _: User = Depends(_STAFF),
):
    """
    Verify Aadhaar card through AUA provider.
    Requires AADHAAR_AUA_URL to be configured for production use.
    """
    result = await kyc_service.verify_aadhaar(
        aadhaar_number=body.aadhaar_number,
        name=body.name,
        dob=body.dob,
        mobile=body.mobile,
    )
    return KycVerificationResponse(**result)


@router.post("/verify/pan", response_model=KycVerificationResponse)
async def verify_pan(
    body: PANVerifyRequest,
    db: Session = Depends(get_db),
    _: User = Depends(_STAFF),
):
    """
    Verify PAN card through NSDL/UTI provider.
    Requires PAN_VERIFICATION_URL to be configured for production use.
    """
    result = await kyc_service.verify_pan(
        pan_number=body.pan_number,
        name=body.name,
        dob=body.dob,
    )
    return KycVerificationResponse(**result)


@router.post("/verify/bank", response_model=KycVerificationResponse)
async def verify_bank_account(
    body: BankAccountVerifyRequest,
    db: Session = Depends(get_db),
    _: User = Depends(_STAFF),
):
    """
    Verify bank account through Penny Drop or similar service.
    Requires BANK_VERIFICATION_URL to be configured for production use.
    """
    result = await kyc_service.verify_bank_account(
        account_number=body.account_number,
        ifsc_code=body.ifsc_code,
        account_holder_name=body.account_holder_name,
    )
    return KycVerificationResponse(**result)
