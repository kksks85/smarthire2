from fastapi import APIRouter, Depends, HTTPException, Form, UploadFile
from fastapi.responses import HTMLResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import ApplicationStatus, CandidatePoolStatus, CandidateSource, JobStatus, KycStatus
from app.db.session import get_db
from app.models.candidate import Candidate
from app.models.field_drive import FieldDrive
from app.models.job import JobPosting
from app.models.pipeline import Application
from app.models.user import User
from app.models.kyc import KycDocument
from app.schemas.candidate import PublicRegistration
from app.schemas.field_drive import PublicDriveInfo
from app.api.v1.admin import get_public_base_url
from app.services.inbound_leads import capture_candidate_registration
from app.integrations.storage import storage

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
        "documents_required": job.documents_required or {},
        "employer": "LAYAM",
    }


@router.get("/jobs/{slug}/share", response_class=HTMLResponse)
def public_job_share(slug: str, db: Session = Depends(get_db)):
    """SEO Proxy for social media scrapers (Facebook/LinkedIn) to get Open Graph tags."""
    job = db.scalar(select(JobPosting).where(JobPosting.public_slug == slug))
    if not job or job.status != "published":
        return HTMLResponse("Job not found", status_code=404)

    base = get_public_base_url(db)
    target_url = f"{base}/careers/{slug}"
    
    title = f"{job.title} at LAYAM"
    location = f"{job.work_city}, {job.work_state}" if job.work_city else "Remote"
    salary = f"₹{job.salary_min}-₹{job.salary_max}/mo" if job.salary_min else "Competitive Salary"
    
    description = f"Join our team! Role: {job.title} | {location} | {salary} | Experience: {job.min_experience_years} yrs."
    if job.description:
        description += f" {job.description[:100]}..."

    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <title>{title}</title>
        <meta property="og:title" content="{title}" />
        <meta property="og:description" content="{description}" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="{target_url}" />
        <meta property="og:image" content="{base}/api/v1/public/jobs/{slug}/banner" />
        <meta property="og:image:width" content="1080" />
        <meta property="og:image:height" content="1350" />
        <meta property="og:image:type" content="image/jpeg" />
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:title" content="{title}" />
        <meta property="twitter:description" content="{description}" />
        <meta property="twitter:image" content="{base}/api/v1/public/jobs/{slug}/banner" />
        <!-- Redirect real users to the actual job page -->
        <meta http-equiv="refresh" content="0; url={target_url}">
        <script>window.location.replace("{target_url}");</script>
    </head>
    <body>
        <p>Redirecting to job details... <a href="{target_url}">Click here</a> if not redirected automatically.</p>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)


@router.get("/jobs/{slug}/banner")
def public_job_banner(slug: str, db: Session = Depends(get_db)):
    """Serves the generated job poster banner as a JPEG streaming response for scrapers."""
    job = db.scalar(select(JobPosting).where(JobPosting.public_slug == slug))
    if not job or job.status != "published":
        raise HTTPException(status_code=404, detail="Job not found")

    from app.integrations.banner import generate_hiring_banner
    location = ", ".join(
        part for part in (job.work_address, job.work_city, job.work_state) if part
    ) or "Not specified"

    base = get_public_base_url(db)
    apply_url = f"{base}/careers/{slug}"

    banner_bytes = generate_hiring_banner(
        title=job.title,
        location=location,
        salary_min=job.salary_min,
        salary_max=job.salary_max,
        apply_url=apply_url,
    )

    import io
    return StreamingResponse(io.BytesIO(banner_bytes), media_type="image/jpeg")
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
    """Candidate self-registration via QR code / website (no auth).

    When the registration is tied to a job slug, a candidate record is created
    (or linked by phone) and an application is created with status INTERESTED.
    """
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

    job: JobPosting | None = None
    if body.job_slug:
        job = db.scalar(
            select(JobPosting).where(
                JobPosting.public_slug == body.job_slug,
                JobPosting.status == JobStatus.PUBLISHED,
            )
        )

    # Link to existing candidate by phone when possible.
    phone_digits = "".join(ch for ch in (body.phone or "") if ch.isdigit())
    existing = db.scalar(select(Candidate).where(Candidate.phone == phone_digits)) if phone_digits else None

    if existing:
        candidate = existing
        candidate.full_name = body.full_name or candidate.full_name
        candidate.email = body.email or candidate.email
        candidate.city = body.city or candidate.city
        candidate.state = body.state or candidate.state
        candidate.primary_trade = body.primary_trade or candidate.primary_trade
    else:
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

    if job and candidate.id:
        existing_app = db.scalar(
            select(Application).where(
                Application.candidate_id == candidate.id,
                Application.job_id == job.id,
                Application.status == ApplicationStatus.INTERESTED,
            )
        )
        if not existing_app:
            db.add(Application(
                candidate_id=candidate.id,
                job_id=job.id,
                status=ApplicationStatus.INTERESTED,
                candidate_interest=True,
            ))
            if candidate.pool_status == CandidatePoolStatus.AVAILABLE:
                candidate.pool_status = CandidatePoolStatus.RESERVED

    db.commit()
    return {"message": "Registration received. Our team will contact you shortly.", "candidate_id": candidate.id}


@router.post("/register/{candidate_id}/upload-document", status_code=201)
async def public_upload_document(
    candidate_id: int,
    document_type: str = Form(...),
    file: UploadFile = ...,
    db: Session = Depends(get_db),
):
    """Public document upload for newly registered candidates (no auth)."""
    candidate = db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    content = await file.read()
    key = storage.save(content, file.filename or "document", file.content_type)
    doc = KycDocument(
        candidate_id=candidate_id,
        document_type=document_type,
        file_key=key,
        original_filename=file.filename,
        content_type=file.content_type,
        status=KycStatus.SUBMITTED,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {"id": doc.id, "document_type": doc.document_type}
