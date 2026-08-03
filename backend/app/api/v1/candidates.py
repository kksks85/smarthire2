import io

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.core.enums import CandidateSource, CandidateStatus, RoleName
from app.db.session import get_db
from app.integrations.excel import parse_campaign_workbook
from app.models.candidate import Candidate, CandidateCustomQuestionResponse
from app.models.org import Institution
from app.models.user import User
from app.schemas.candidate import (
    CandidateCreate,
    CandidateOut,
    CandidatePii,
    CandidateUpdate,
    QuickCandidateCreate,
    StudentCentralOut,
)
from app.services.audit import record_pii_access
from app.services.inbound_leads import capture_candidate_registration
from app.services.pii import mask_address, mask_email, mask_phone

router = APIRouter(prefix="/candidates", tags=["candidates"])

_STAFF = require_roles(
    RoleName.ADMIN, RoleName.MANAGER, RoleName.RECRUITER, RoleName.FIELD_AGENT
)
_CAMPAIGN_IMPORTERS = require_roles(RoleName.ADMIN, RoleName.MANAGER, RoleName.RECRUITER)


def normalize_phone(phone: str) -> str:
    return "".join(character for character in phone if character.isdigit())


_ADMIN_MGR = require_roles(RoleName.ADMIN, RoleName.MANAGER)


def serialize_masked(c: Candidate) -> CandidateOut:
    out = CandidateOut.model_validate(c)
    out.phone = mask_phone(c.phone)
    out.email = mask_email(c.email)
    out.address = mask_address(c.address)
    out.pii_masked = True
    return out


@router.get("", response_model=dict)
def list_candidates(
    q: str | None = None,
    trade: str | None = None,
    state: str | None = None,
    status: CandidateStatus | None = None,
    source: CandidateSource | None = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
    _: User = Depends(_STAFF),
):
    stmt = select(Candidate)
    if q:
        stmt = stmt.where(Candidate.full_name.ilike(f"%{q}%"))
    if trade:
        stmt = stmt.where(Candidate.primary_trade == trade)
    if state:
        stmt = stmt.where(Candidate.state == state)
    if status:
        stmt = stmt.where(Candidate.status == status)
    if source:
        stmt = stmt.where(Candidate.source == source)

    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(
        stmt.order_by(Candidate.created_at.desc()).limit(limit).offset(offset)
    ).all()
    return {
        "total": total,
        "items": [serialize_masked(c) for c in rows],
    }


@router.get("/student-central", response_model=dict)
def student_central(
    q: str | None = None,
    trade: str | None = None,
    state: str | None = None,
    status: CandidateStatus | None = None,
    institution_id: int | None = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
    _: User = Depends(_ADMIN_MGR),
):
    """Admin central repository of all candidates uploaded by institutions."""
    stmt = (
        select(Candidate, Institution.name.label("institution_name"))
        .join(Institution, Candidate.institution_id == Institution.id, isouter=True)
        .where(Candidate.source == CandidateSource.INSTITUTION_UPLOAD)
    )
    if q:
        stmt = stmt.where(Candidate.full_name.ilike(f"%{q}%"))
    if trade:
        stmt = stmt.where(Candidate.primary_trade == trade)
    if state:
        stmt = stmt.where(Candidate.state == state)
    if status:
        stmt = stmt.where(Candidate.status == status)
    if institution_id:
        stmt = stmt.where(Candidate.institution_id == institution_id)

    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.execute(
        stmt.order_by(Candidate.created_at.desc()).limit(limit).offset(offset)
    ).all()

    items: list[StudentCentralOut] = []
    for candidate, institution_name in rows:
        out = StudentCentralOut.model_validate(candidate)
        out.phone = mask_phone(candidate.phone)
        out.email = mask_email(candidate.email)
        out.address = mask_address(candidate.address)
        out.institution_name = institution_name
        out.pii_masked = True
        items.append(out)

    return {"total": total, "items": items}


@router.get("/facebook-campaign-template")
def download_facebook_campaign_template(_: User = Depends(_STAFF)):
    """Download the official Excel template for Facebook Campaign bulk candidate import."""
    wb = Workbook()
    ws = wb.active
    ws.title = "FB Campaign Import Template"

    headers = [
        "Name",
        "Phone",
        "Question 1",
        "Answer 1",
        "Question 2",
        "Answer 2",
        "Question 3",
        "Answer 3",
        "Question 4",
        "Answer 4",
        "Question 5",
        "Answer 5",
    ]
    ws.append(headers)

    ws.append([
        "Kamal Sharma",
        "9876543210",
        "Primary Trade / Skill",
        "Wiring DB Install",
        "Years of Experience",
        "3",
        "Current City",
        "Surat",
        "Highest Qualification",
        "ITI Electrician",
        "Expected Monthly Salary (INR)",
        "18000",
    ])
    ws.append([
        "Uttam Choyal",
        "9876543211",
        "Primary Trade / Skill",
        "Fitter",
        "Years of Experience",
        "2",
        "Current City",
        "Ahmedabad",
        "Highest Qualification",
        "12th Pass",
        "Expected Monthly Salary (INR)",
        "16000",
    ])

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)

    res_headers = {
        "Content-Disposition": 'attachment; filename="facebook_campaign_template.xlsx"'
    }
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=res_headers,
    )


@router.post("/import-facebook-campaign")
async def import_facebook_campaign(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(_CAMPAIGN_IMPORTERS),
):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=400, detail="Please upload an .xlsx file")

    rows, errors = parse_campaign_workbook(await file.read())
    if not rows and errors:
        raise HTTPException(status_code=400, detail=" ".join(errors))

    existing_candidates = db.scalars(select(Candidate)).all()
    candidates_by_phone = {
        normalize_phone(candidate.phone): candidate
        for candidate in existing_candidates
        if normalize_phone(candidate.phone)
    }
    created = 0
    updated = 0

    try:
        for record in rows:
            normalized_phone = normalize_phone(record["phone"])
            if not normalized_phone:
                errors.append(f"Candidate {record['full_name']}: phone contains no digits - skipped.")
                continue

            candidate = candidates_by_phone.get(normalized_phone)
            if candidate is None:
                candidate = Candidate(
                    full_name=record["full_name"],
                    phone=normalized_phone,
                    source=CandidateSource.SOCIAL_MEDIA,
                    profile_data={"registration_channel": "facebook"},
                    registered_by_id=current_user.id,
                )
                db.add(candidate)
                db.flush()
                capture_candidate_registration(db, candidate)
                candidates_by_phone[normalized_phone] = candidate
                created += 1
            else:
                updated += 1

            responses_by_number = {
                response.question_number: response
                for response in candidate.custom_question_responses
            }
            for response_data in record["responses"]:
                response = responses_by_number.get(response_data["question_number"])
                if response is None:
                    response = CandidateCustomQuestionResponse(
                        candidate_id=candidate.id,
                        question_number=response_data["question_number"],
                    )
                    db.add(response)
                response.question = response_data["question"]
                response.answer = response_data["answer"]
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"created": created, "updated": updated, "skipped": len(errors), "errors": errors}


@router.post("", response_model=CandidateOut, status_code=201)
def create_candidate(
    body: CandidateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_STAFF),
):
    payload = body.model_dump()
    # Registrations tied to a field drive are always attributed to the
    # field agent who ran it, regardless of what the client sent.
    if payload.get("field_drive_id"):
        payload["source"] = CandidateSource.FIELD_AGENT
    candidate = Candidate(**payload, registered_by_id=current_user.id)
    db.add(candidate)
    db.flush()
    capture_candidate_registration(db, candidate)
    db.commit()
    db.refresh(candidate)
    return serialize_masked(candidate)


@router.post("/quick", response_model=CandidateOut, status_code=201)
def create_quick_candidate(
    body: QuickCandidateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_STAFF),
):
    """Minimal on-the-spot candidate registration for field agents.

    Only name, phone, email, and aadhaar are required. The full profile
    can be completed later through the standard candidate form.
    """
    candidate = Candidate(
        full_name=body.full_name,
        phone=body.phone,
        email=body.email,
        aadhaar_last4=body.aadhaar_last4,
        city=body.city,
        state=body.state,
        primary_trade=body.primary_trade,
        source=CandidateSource.FIELD_AGENT,
        registered_by_id=current_user.id,
        field_drive_id=body.field_drive_id,
        profile_data={"quick_registration": True},
    )
    db.add(candidate)
    db.flush()
    capture_candidate_registration(db, candidate)
    db.commit()
    db.refresh(candidate)
    return serialize_masked(candidate)



@router.get("/{candidate_id}", response_model=CandidateOut)
def get_candidate(
    candidate_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(_STAFF),
):
    candidate = db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return serialize_masked(candidate)


@router.patch("/{candidate_id}", response_model=CandidateOut)
def update_candidate(
    candidate_id: int,
    body: CandidateUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(_STAFF),
):
    candidate = db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(candidate, field, value)
    db.commit()
    db.refresh(candidate)
    return serialize_masked(candidate)


@router.post("/{candidate_id}/reveal", response_model=CandidatePii)
def reveal_pii(
    candidate_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(_STAFF),
):
    """Unmask candidate PII. Every reveal is recorded in the PII access log."""
    candidate = db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    record_pii_access(
        db,
        user_id=current_user.id,
        candidate_id=candidate.id,
        fields_revealed=["phone", "email", "address"],
        ip_address=request.client.host if request.client else None,
    )
    return CandidatePii(
        id=candidate.id,
        phone=candidate.phone,
        email=candidate.email,
        address=candidate.address,
    )
