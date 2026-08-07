import secrets
from datetime import datetime, timezone
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.v1.admin import get_public_base_url
from app.core.deps import require_roles
from app.core.enums import ApprovalDecision, JobStatus, RoleName
from app.db.session import get_db
from app.integrations.qr import generate_qr_data_uri
from app.integrations.banner import generate_hiring_banner
from app.integrations.linkedin import linkedin_service
from app.integrations.facebook import facebook_service
from app.integrations.whatsapp import whatsapp_service
from app.models.candidate import Candidate
from app.models.job import JobApproval, JobPosting
from app.models.org import Employer
from app.models.user import User
from app.models.whatsapp import WhatsAppCampaign, WhatsAppCampaignRecipient, WhatsAppSettings
from app.schemas.job import (
    ApprovalOut,
    ApprovalRequest,
    JobCreate,
    JobOut,
    JobUpdate,
    PublishOut,
    WhatsAppCampaignCreate,
    WhatsAppCampaignOut,
    WhatsAppCampaignPreview,
    WhatsAppTestSendOut,
)
from app.schemas.pipeline import AssignRecruiter
from app.services.audit import record_audit
from app.services.whatsapp_campaigns import is_available_for_campaign, match_score

router = APIRouter(prefix="/jobs", tags=["jobs"])

_CREATORS = require_roles(RoleName.ADMIN, RoleName.MANAGER, RoleName.RECRUITER)
_APPROVERS = require_roles(RoleName.MANAGER, RoleName.ADMIN)
_VIEWERS = require_roles(
    RoleName.ADMIN, RoleName.MANAGER, RoleName.RECRUITER, RoleName.EMPLOYER
)


@router.get("", response_model=list[JobOut])
def list_jobs(
    status: JobStatus | None = None,
    with_stats: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(_VIEWERS),
):
    stmt = select(JobPosting).order_by(JobPosting.created_at.desc())
    if status:
        stmt = stmt.where(JobPosting.status == status)
    jobs = db.scalars(stmt).all()
    if not with_stats:
        return jobs

    from app.core.enums import ApplicationStatus
    from app.models.pipeline import Application

    job_ids = [j.id for j in jobs]
    counts: dict[int, dict[str, int]] = {j.id: {
        "interested": 0,
        "contact_successful": 0,
        "blocked_for_position": 0,
    } for j in jobs}
    if job_ids:
        rows = db.execute(
            select(Application.job_id, Application.status, func.count(Application.id))
            .where(
                Application.job_id.in_(job_ids),
                Application.status.in_([
                    ApplicationStatus.INTERESTED,
                    ApplicationStatus.CONTACT_PENDING,
                    ApplicationStatus.ASSIGNED,
                    ApplicationStatus.CONTACT_ATTEMPTED,
                    ApplicationStatus.CONTACT_SUCCESSFUL,
                    ApplicationStatus.SCREENING,
                    ApplicationStatus.IN_INTERVIEW,
                    ApplicationStatus.DOCUMENTS,
                    ApplicationStatus.KYC,
                    ApplicationStatus.VALIDATED,
                    ApplicationStatus.SELECTED,
                    ApplicationStatus.BLOCKED_FOR_POSITION,
                    ApplicationStatus.QUALIFIED,
                    ApplicationStatus.PLACED,
                ]),
            )
            .group_by(Application.job_id, Application.status)
        ).all()
        for job_id, app_status, count in rows:
            if app_status in (
                ApplicationStatus.INTERESTED,
                ApplicationStatus.CONTACT_PENDING,
                ApplicationStatus.ASSIGNED,
                ApplicationStatus.CONTACT_ATTEMPTED,
            ):
                counts[job_id]["interested"] += count
            elif app_status == ApplicationStatus.CONTACT_SUCCESSFUL:
                counts[job_id]["contact_successful"] += count
            elif app_status in (
                ApplicationStatus.SCREENING,
                ApplicationStatus.IN_INTERVIEW,
                ApplicationStatus.DOCUMENTS,
                ApplicationStatus.KYC,
                ApplicationStatus.VALIDATED,
                ApplicationStatus.SELECTED,
                ApplicationStatus.BLOCKED_FOR_POSITION,
                ApplicationStatus.QUALIFIED,
                ApplicationStatus.PLACED,
            ):
                counts[job_id]["blocked_for_position"] += count

    result = []
    for job in jobs:
        data = JobOut.model_validate(job).model_dump()
        data["stats"] = counts.get(job.id, {
            "interested": 0,
            "contact_successful": 0,
            "blocked_for_position": 0,
        })
        result.append(data)
    return result


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
    whatsapp_message = (
        f"We are hiring: {job.title}\n"
        f"Location: {', '.join(part for part in (job.work_city, job.work_state) if part) or 'Not specified'}\n"
        f"Apply here: {base}/apply/{job.public_slug}?source=whatsapp"
    )
    return PublishOut(
        id=job.id,
        status=job.status,
        public_slug=job.public_slug,
        public_url=public_url,
        apply_url=apply_url,
        qr_data_uri=generate_qr_data_uri(apply_url),
        share_facebook_url=f"https://www.facebook.com/sharer/sharer.php?u={quote(f'{base}/apply/{job.public_slug}?source=facebook')}",
        share_linkedin_url=f"https://www.linkedin.com/sharing/share-offsite/?url={quote(f'{base}/apply/{job.public_slug}?source=linkedin')}",
        share_whatsapp_url=f"https://wa.me/?text={quote(whatsapp_message)}",
    )


def _whatsapp_candidates(job: JobPosting, db: Session) -> list[tuple[Candidate, int]]:
    matches: list[tuple[Candidate, int]] = []
    for candidate in db.scalars(select(Candidate)).all():
        if not is_available_for_campaign(candidate):
            continue
        score = match_score(job, candidate)
        if score > 0:
            matches.append((candidate, score))
    return matches


@router.post("/{job_id}/whatsapp-test-send", response_model=WhatsAppTestSendOut)
def send_whatsapp_test_message(
    job_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(_APPROVERS),
):
    """Send one QR-bearing job share to the fixed development test recipient."""
    job = db.get(JobPosting, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != JobStatus.PUBLISHED:
        raise HTTPException(status_code=400, detail="Job must be published before sharing on WhatsApp")
    settings = db.get(WhatsAppSettings, 1)
    if not whatsapp_service.is_configured(settings):
        raise HTTPException(status_code=400, detail="WhatsApp is not configured or enabled by an administrator.")

    test_recipient = "9035153413"
    base = get_public_base_url(db)
    apply_url = f"{base}/apply/{job.public_slug}?source=whatsapp_test"
    location = ", ".join(
        part for part in (job.work_address, job.work_city, job.work_state) if part
    ) or "Not specified"
    try:
        is_connectivity_template = settings.template_name == "hello_world"
        media_id = None
        body_values = None
        if not is_connectivity_template:
            media_id = whatsapp_service.upload_media(
                settings,
                generate_hiring_banner(
                    title=job.title,
                    location=location,
                    salary_min=job.salary_min,
                    salary_max=job.salary_max,
                    apply_url=apply_url,
                ),
            )
            body_values = [
                job.title,
                location,
                str(job.salary_min or ""),
                str(job.salary_max or ""),
                apply_url,
            ]
        message_id = whatsapp_service.send_template(
            settings,
            recipient_phone=test_recipient,
            media_id=media_id,
            body_values=body_values,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"WhatsApp test send failed: {str(exc)[:500]}") from exc

    record_audit(
        db,
        user_id=current_user.id,
        action="job.whatsapp_test_send",
        entity_type="job",
        entity_id=job.id,
        detail=f"recipient={test_recipient}; provider_message_id={message_id}",
        ip_address=request.client.host if request.client else None,
    )
    return WhatsAppTestSendOut(
        recipient_phone=test_recipient,
        provider_message_id=message_id,
    )


@router.get("/{job_id}/whatsapp-campaign-preview", response_model=WhatsAppCampaignPreview)
def whatsapp_campaign_preview(
    job_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(_APPROVERS),
):
    job = db.get(JobPosting, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != JobStatus.PUBLISHED:
        raise HTTPException(status_code=400, detail="Job must be published before sharing on WhatsApp")
    settings = db.get(WhatsAppSettings, 1)
    return WhatsAppCampaignPreview(
        eligible_count=len(_whatsapp_candidates(job, db)),
        whatsapp_configured=whatsapp_service.is_configured(settings),
    )


@router.post("/{job_id}/whatsapp-campaigns", response_model=WhatsAppCampaignOut, status_code=202)
def create_whatsapp_campaign(
    job_id: int,
    body: WhatsAppCampaignCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(_APPROVERS),
):
    if not body.confirm:
        raise HTTPException(status_code=422, detail="Confirm the recipient count before sending.")
    job = db.get(JobPosting, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != JobStatus.PUBLISHED:
        raise HTTPException(status_code=400, detail="Job must be published before sharing on WhatsApp")
    settings = db.get(WhatsAppSettings, 1)
    if not whatsapp_service.is_configured(settings):
        raise HTTPException(status_code=400, detail="WhatsApp is not configured or enabled by an administrator.")

    matches = _whatsapp_candidates(job, db)
    if not matches:
        raise HTTPException(status_code=400, detail="No matching available candidates were found.")
    base = get_public_base_url(db)
    apply_url = f"{base}/apply/{job.public_slug}?source=whatsapp"
    campaign = WhatsAppCampaign(
        job_id=job.id,
        created_by_id=current_user.id,
        apply_url=apply_url,
        recipient_count=len(matches),
    )
    db.add(campaign)
    db.flush()
    db.add_all(
        WhatsAppCampaignRecipient(
            campaign_id=campaign.id,
            candidate_id=candidate.id,
            phone_snapshot=whatsapp_service.normalize_phone(candidate.phone),
            match_score=score,
        )
        for candidate, score in matches
    )
    record_audit(
        db,
        user_id=current_user.id,
        action="job.whatsapp_campaign.queue",
        entity_type="job",
        entity_id=job.id,
        detail=f"campaign_id={campaign.id}; recipients={len(matches)}",
        ip_address=request.client.host if request.client else None,
        commit=False,
    )
    db.commit()
    from app.worker import whatsapp_send_campaign
    whatsapp_send_campaign.delay(campaign.id)
    return WhatsAppCampaignOut(
        id=campaign.id,
        status=campaign.status,
        recipient_count=campaign.recipient_count,
        sent_count=campaign.sent_count,
        failed_count=campaign.failed_count,
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


@router.post("/{job_id}/post-facebook")
def post_job_to_facebook(
    job_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(_CREATORS),
):
    """Post a published job to Facebook company page directly."""
    job = db.get(JobPosting, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.status != JobStatus.PUBLISHED:
        raise HTTPException(status_code=400, detail="Job must be published to post on Facebook")
    
    if not facebook_service.is_configured():
        raise HTTPException(
            status_code=400,
            detail="Facebook API not configured. Please set FACEBOOK_ACCESS_TOKEN and FACEBOOK_PAGE_ID in environment variables."
        )
    
    # Get the public URL
    base = get_public_base_url(db)
    apply_url = f"{base}/apply/{job.public_slug}?source=facebook"
    location = ", ".join(
        part for part in (job.work_address, job.work_city, job.work_state) if part
    ) or "Not specified"
    
    # Post to Facebook
    result = facebook_service.post_job(
        title=job.title,
        description=job.description or "",
        location=location,
        job_url=apply_url,
        salary_min=job.salary_min,
        salary_max=job.salary_max,
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    # Log the action
    record_audit(
        db=db,
        user_id=user.id,
        action="post_job_to_facebook",
        entity_type="JobPosting",
        entity_id=job_id,
        detail=f"Facebook post ID: {result.get('data', {}).get('id', '')}",
    )
    
    return {
        "success": True,
        "message": result["message"],
        "post_url": result.get("data", {}).get("id", "")
    }
