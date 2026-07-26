from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.core.enums import CandidateSource, CandidateStatus, RoleName
from app.db.session import get_db
from app.models.candidate import Candidate
from app.models.user import User
from app.schemas.candidate import (
    CandidateCreate,
    CandidateOut,
    CandidatePii,
    CandidateUpdate,
)
from app.services.audit import record_pii_access
from app.services.pii import mask_address, mask_email, mask_phone

router = APIRouter(prefix="/candidates", tags=["candidates"])

_STAFF = require_roles(
    RoleName.ADMIN, RoleName.MANAGER, RoleName.RECRUITER, RoleName.FIELD_AGENT
)


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
