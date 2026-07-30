from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import CandidateSource
from app.db.session import get_db
from app.models.candidate import Candidate
from app.models.field_drive import FieldDrive
from app.models.job import JobPosting
from app.models.user import User
from app.schemas.candidate import PublicRegistration
from app.schemas.field_drive import PublicDriveInfo
from app.services.inbound_leads import capture_candidate_registration

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/jobs/{slug}")
def public_job(slug: str, db: Session = Depends(get_db)):
    """Public job details for the careers/apply pages (no auth)."""
    job = db.scalar(select(JobPosting).where(JobPosting.public_slug == slug))
    if not job or job.status != "published":
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "title": job.title,
        "category": job.category,
        "description": job.description,
        "employment_type": job.employment_type,
        "shift_type": job.shift_type,
        "salary_min": job.salary_min,
        "salary_max": job.salary_max,
        "work_city": job.work_city,
        "work_state": job.work_state,
        "accommodation_provided": job.accommodation_provided,
        "slug": job.public_slug,
        "required_candidate_fields": job.required_candidate_fields or {},
    }


@router.get("/drives/{slug}", response_model=PublicDriveInfo)
def public_drive(slug: str, db: Session = Depends(get_db)):
    """Public field-drive details for the candidate self-registration page (no auth)."""
    drive = db.scalar(select(FieldDrive).where(FieldDrive.public_slug == slug))
    if not drive or drive.status != "active":
        raise HTTPException(status_code=404, detail="Registration drive not found or closed")
    agent = db.get(User, drive.field_agent_id)
    return PublicDriveInfo(
        title=drive.title,
        venue_name=drive.venue_name,
        setup_type=drive.setup_type,
        address=drive.address,
        city=drive.city,
        state=drive.state,
        field_agent_name=agent.full_name if agent else None,
        slug=drive.public_slug,
    )


@router.post("/register", status_code=201)
def public_register(body: PublicRegistration, db: Session = Depends(get_db)):
    """Candidate self-registration via QR code / website (no auth)."""
    drive: FieldDrive | None = None
    if body.drive_slug:
        drive = db.scalar(
            select(FieldDrive).where(
                FieldDrive.public_slug == body.drive_slug, FieldDrive.status == "active"
            )
        )
        if not drive:
            raise HTTPException(status_code=404, detail="Registration drive not found or closed")

    if drive:
        source = CandidateSource.FIELD_AGENT
    elif body.registration_channel in {"facebook", "linkedin"}:
        source = CandidateSource.SOCIAL_MEDIA
    elif body.registration_channel == "website":
        source = CandidateSource.WEBSITE
    elif body.job_slug:
        source = CandidateSource.QR_SELF_REGISTRATION
    else:
        source = CandidateSource.WEBSITE

    candidate = Candidate(
        full_name=body.full_name,
        phone=body.phone,
        email=body.email,
        city=body.city,
        state=body.state,
        primary_trade=body.primary_trade,
        experience_years=body.experience_years or 0,
        source=source,
        registered_by_id=drive.field_agent_id if drive else None,
        field_drive_id=drive.id if drive else None,
        profile_data={"registration_channel": body.registration_channel} if body.registration_channel else {},
    )
    db.add(candidate)
    db.flush()
    capture_candidate_registration(db, candidate)
    db.commit()
    return {"message": "Registration received. Our team will contact you shortly."}
