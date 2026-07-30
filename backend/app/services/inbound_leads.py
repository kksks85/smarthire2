import json

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.enums import CandidateSource
from app.models.audit import AgentLocationLog
from app.models.candidate import Candidate
from app.models.field_drive import FieldDrive
from app.models.lead import LeadInbound


def capture_candidate_registration(db: Session, candidate: Candidate) -> LeadInbound:
    """Create the linked inbound lead used to track every candidate registration."""
    if candidate.source == CandidateSource.SOCIAL_MEDIA:
        source = "Social Media"
        channel = (candidate.profile_data or {}).get("registration_channel", "")
        detail = {"facebook": "Facebook", "linkedin": "LinkedIn"}.get(channel.lower(), channel or "Social Media")
    elif candidate.source == CandidateSource.FIELD_AGENT:
        drive = db.get(FieldDrive, candidate.field_drive_id) if candidate.field_drive_id else None
        source = "Field Agent"
        location_log = db.scalar(
            select(AgentLocationLog)
            .where(AgentLocationLog.candidate_id == candidate.id)
            .order_by(AgentLocationLog.created_at.desc())
        )
        if not location_log and candidate.registered_by_id:
            location_log = db.scalar(
                select(AgentLocationLog)
                .where(AgentLocationLog.field_agent_id == candidate.registered_by_id)
                .order_by(AgentLocationLog.created_at.desc())
            )
        if location_log:
            detail = f"GPS: {location_log.latitude:.6f}, {location_log.longitude:.6f}"
            if location_log.location_name:
                detail = f"{detail} ({location_log.location_name})"
        elif drive and drive.latitude is not None and drive.longitude is not None:
            detail = f"GPS: {drive.latitude:.6f}, {drive.longitude:.6f}"
        elif drive:
            detail = ", ".join(part for part in (drive.venue_name, drive.city, drive.state) if part)
        else:
            detail = "Field agent registration"
    elif candidate.source == CandidateSource.WEBSITE:
        source = "Registered from SmartHire application"
        detail = "SmartHire website"
    else:
        source = "Registered from SmartHire application"
        detail = "SmartHire application"

    lead = LeadInbound(
        source=source,
        source_detail=detail,
        raw_payload=json.dumps({"candidate_source": candidate.source, "detail": detail}),
        full_name=candidate.full_name,
        phone=candidate.phone,
        email=candidate.email,
        trade=candidate.primary_trade,
        city=candidate.city,
        state=candidate.state,
        candidate_id=candidate.id,
    )
    db.add(lead)
    return lead
