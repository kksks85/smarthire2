import secrets
from datetime import datetime, timezone
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.admin import get_public_base_url
from app.core.deps import require_roles
from app.core.enums import ApprovalDecision, JobStatus, RoleName
from app.db.session import get_db
from app.integrations.qr import generate_qr_data_uri
from app.integrations.linkedin import linkedin_service
from app.models.job import JobApproval, JobPosting
from app.models.org import Employer
from app.models.user import User
from app.schemas.job import (
    ApprovalOut,
    ApprovalRequest,
    JobCreate,
    JobOut,
    JobUpdate,
    PublishOut,
)
from app.schemas.pipeline import AssignRecruiter
from app.services.audit import record_audit

router = APIRouter(prefix="/jobs", tags=["jobs"])

_CREATORS = require_roles(RoleName.ADMIN, RoleName.MANAGER, RoleName.RECRUITER)
_APPROVERS = require_roles(RoleName.MANAGER, RoleName.ADMIN)
_VIEWERS = require_roles(
    RoleName.ADMIN, RoleName.MANAGER, RoleName.RECRUITER, RoleName.EMPLOYER
)


@router.get("", response_model=list[JobOut])
def list_jobs(
    status: JobStatus | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(_VIEWERS),
):
    stmt = select(JobPosting).order_by(JobPosting.created_at.desc())
    if status:
        stmt = stmt.where(JobPosting.status == status)
    return db.scalars(stmt).all()


@router.post("", response_model=JobOut, status_code=201)
def create_job(
    body: JobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_CREATORS),
):
    payload = body.model_dump()
    
    # Inherit mandatory candidate field requirements from employer if not explicitly provided
    if not payload.get("required_candidate_fields"):
        employer = db.get(Employer, body.employer_id)
        if not employer:
            raise HTTPException(status_code=404, detail="Employer not found")
        payload["required_candidate_fields"] = employer.required_candidate_fields or {}
    
    job = JobPosting(**payload, created_by_id=current_user.id)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.get("/{job_id}", response_model=JobOut)
def get_job(job_id: int, db: Session = Depends(get_db), _: User = Depends(_VIEWERS)):
    job = db.get(JobPosting, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.patch("/{job_id}", response_model=JobOut)
def update_job(
    job_id: int,
    body: JobUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(_CREATORS),
):
    job = db.get(JobPosting, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status not in (JobStatus.DRAFT, JobStatus.REJECTED):
        raise HTTPException(status_code=400, detail="Only draft/rejected jobs can be edited")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(job, field, value)
    db.commit()
    db.refresh(job)
    return job


@router.post("/{job_id}/submit", response_model=JobOut)
def submit_for_approval(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_CREATORS),
):
    job = db.get(JobPosting, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status not in (JobStatus.DRAFT, JobStatus.REJECTED):
        raise HTTPException(status_code=400, detail="Job is not in a submittable state")

    job.status = JobStatus.PENDING_APPROVAL
    db.add(JobApproval(job_id=job.id, decision=ApprovalDecision.PENDING))
    record_audit(
        db, user_id=current_user.id, action="job.submit", entity_type="job",
        entity_id=job.id, commit=False,
    )
    db.commit()
    db.refresh(job)
    return job


@router.post("/{job_id}/approve", response_model=JobOut)
def decide_approval(
    job_id: int,
    body: ApprovalRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(_APPROVERS),
):
    job = db.get(JobPosting, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != JobStatus.PENDING_APPROVAL:
        raise HTTPException(status_code=400, detail="Job is not pending approval")

    approval = db.scalar(
        select(JobApproval)
        .where(JobApproval.job_id == job.id, JobApproval.decision == ApprovalDecision.PENDING)
        .order_by(JobApproval.created_at.desc())
    )
    if not approval:
        approval = JobApproval(job_id=job.id)
        db.add(approval)

    approval.decision = body.decision
    approval.comments = body.comments
    approval.approver_id = current_user.id
    approval.decided_at = datetime.now(timezone.utc)

    if body.decision == ApprovalDecision.APPROVED:
        job.status = JobStatus.APPROVED
    else:
        job.status = JobStatus.REJECTED

    record_audit(
        db, user_id=current_user.id, action=f"job.{body.decision.value}",
        entity_type="job", entity_id=job.id, detail=body.comments,
        ip_address=request.client.host if request.client else None, commit=False,
    )
    db.commit()
    db.refresh(job)
    return job


@router.post("/{job_id}/assign-recruiter", response_model=JobOut)
def assign_job_recruiter(
    job_id: int,
    body: AssignRecruiter,
    db: Session = Depends(get_db),
    _: User = Depends(_APPROVERS),
):
    job = db.get(JobPosting, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status not in (JobStatus.APPROVED, JobStatus.PUBLISHED):
        raise HTTPException(status_code=400, detail="Approve the job before assigning a recruiter")
    recruiter = db.get(User, body.assigned_recruiter_id)
    if not recruiter or recruiter.role.name != RoleName.RECRUITER:
        raise HTTPException(status_code=400, detail="Select an active recruiter")
    if not recruiter.is_active:
        raise HTTPException(status_code=400, detail="Selected recruiter is inactive")
    job.assigned_recruiter_id = recruiter.id
    db.commit()
    db.refresh(job)
    return job


@router.get("/{job_id}/approvals", response_model=list[ApprovalOut])
def list_approvals(job_id: int, db: Session = Depends(get_db), _: User = Depends(_VIEWERS)):
    return db.scalars(
        select(JobApproval).where(JobApproval.job_id == job_id).order_by(JobApproval.created_at)
    ).all()


@router.post("/{job_id}/publish", response_model=PublishOut)
def publish_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_APPROVERS),
):
    job = db.get(JobPosting, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status not in (JobStatus.APPROVED, JobStatus.PUBLISHED):
        raise HTTPException(status_code=400, detail="Job must be approved before publishing")

    if not job.public_slug:
        job.public_slug = secrets.token_urlsafe(8)
    job.status = JobStatus.PUBLISHED
    job.published_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)

    base = get_public_base_url(db)
    public_url = f"{base}/careers/{job.public_slug}"
    apply_url = f"{base}/apply/{job.public_slug}?source=website"
    return PublishOut(
        id=job.id,
        status=job.status,
        public_slug=job.public_slug,
        public_url=public_url,
        apply_url=apply_url,
        qr_data_uri=generate_qr_data_uri(apply_url),
        share_facebook_url=f"https://www.facebook.com/sharer/sharer.php?u={quote(f'{base}/apply/{job.public_slug}?source=facebook')}",
        share_linkedin_url=f"https://www.linkedin.com/sharing/share-offsite/?url={quote(f'{base}/apply/{job.public_slug}?source=linkedin')}",
    )


@router.post("/{job_id}/post-linkedin")
def post_job_to_linkedin(
    job_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(_CREATORS),
):
    """Post a published job to LinkedIn company page directly."""
    job = db.get(JobPosting, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.status != JobStatus.PUBLISHED:
        raise HTTPException(status_code=400, detail="Job must be published to post on LinkedIn")
    
    if not linkedin_service.is_configured():
        raise HTTPException(
            status_code=400,
            detail="LinkedIn API not configured. Please set LINKEDIN_ACCESS_TOKEN and LINKEDIN_COMPANY_ID in environment variables."
        )
    
    # Get the public URL
    base = get_public_base_url(db)
    apply_url = f"{base}/apply/{job.public_slug}?source=linkedin"
    location = ", ".join(
        part for part in (job.work_address, job.work_city, job.work_state) if part
    ) or "Not specified"
    
    # Post to LinkedIn
    result = linkedin_service.post_job(
        title=job.title,
        description=job.description or "",
        location=location,
        job_url=apply_url,
        salary_min=job.salary_min,
        salary_max=job.salary_max,
        employment_type=job.employment_type or "CONTRACT",
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    # Log the action
    record_audit(
        db=db,
        user_id=user.id,
        action="post_job_to_linkedin",
        entity_type="JobPosting",
        entity_id=job_id,
        detail=f"LinkedIn post ID: {result.get('data', {}).get('id', '')}",
    )
    
    return {
        "success": True,
        "message": result["message"],
        "post_url": result.get("data", {}).get("id", "")
    }
