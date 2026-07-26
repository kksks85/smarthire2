import json

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.core.enums import CandidateSource, LeadStatus, RoleName
from app.db.session import get_db
from app.models.candidate import Candidate
from app.models.lead import LeadInbound
from app.models.user import User
from app.schemas.lead import InboundLeadPayload, LeadOut

router = APIRouter(prefix="/leads", tags=["leads"])

_STAFF = require_roles(RoleName.ADMIN, RoleName.MANAGER, RoleName.RECRUITER)


@router.post("/webhook", response_model=LeadOut, status_code=201)
def inbound_webhook(payload: InboundLeadPayload, db: Session = Depends(get_db)):
    """Generic inbound lead webhook (v1). No auth — secure via gateway/IP allowlist."""
    lead = LeadInbound(
        source=payload.source,
        raw_payload=json.dumps(payload.model_dump()),
        full_name=payload.full_name,
        phone=payload.phone,
        email=payload.email,
        trade=payload.trade,
        city=payload.city,
        state=payload.state,
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


@router.get("", response_model=list[LeadOut])
def list_leads(
    status: LeadStatus | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(_STAFF),
):
    stmt = select(LeadInbound).order_by(LeadInbound.created_at.desc())
    if status:
        stmt = stmt.where(LeadInbound.status == status)
    return db.scalars(stmt).all()


@router.post("/{lead_id}/promote", response_model=LeadOut)
def promote_lead(lead_id: int, db: Session = Depends(get_db), current_user: User = Depends(_STAFF)):
    lead = db.get(LeadInbound, lead_id)
    if not lead:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Lead not found")

    candidate = Candidate(
        full_name=lead.full_name or "Unknown",
        phone=lead.phone or "",
        email=lead.email,
        city=lead.city,
        state=lead.state,
        primary_trade=lead.trade,
        source=CandidateSource.INBOUND_WEBHOOK,
        registered_by_id=current_user.id,
    )
    db.add(candidate)
    db.flush()
    lead.status = LeadStatus.PROMOTED
    lead.candidate_id = candidate.id
    db.commit()
    db.refresh(lead)
    return lead
