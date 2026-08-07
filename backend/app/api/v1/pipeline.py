from datetime import datetime, timezone
import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.core.enums import (
    ApplicationStatus,
    CandidatePoolStatus,
    CandidateStatus,
    JobStatus,
    RoleName,
    StageOutcome,
    StageType,
)
from app.db.session import get_db
from app.models.candidate import Candidate
from app.models.job import JobPosting
from app.models.kyc import KycDocument
from app.models.pipeline import (
    Application,
    InterviewStageConfig,
    RecruiterContactAttempt,
    ScreeningQuestion,
    ScreeningResponse,
    StageEvaluation,
)
from app.models.user import User
from app.schemas.pipeline import (
    ApplicationCreate,
    ApplicationOut,
    AssignRecruiter,
    CandidateInterestRequest,
    ContactAttemptCreate,
    ContactAttemptOut,
    EvaluationCreate,
    EvaluationOut,
    ScreeningQuestionCreate,
    ScreeningQuestionOut,
    ScreeningMatch,
    ScreeningResponseOut,
    ScreeningResponsesSave,
    StageConfigOut,
)
from app.services.audit import record_audit

router = APIRouter(tags=["pipeline"])

_MGR_ADMIN = require_roles(RoleName.ADMIN, RoleName.MANAGER)
_STAFF = require_roles(RoleName.ADMIN, RoleName.MANAGER, RoleName.RECRUITER)

# Ordered pipeline used to advance applications.
_STAGE_ORDER = [
    StageType.SCREENING,
    StageType.CLIENT_INTERVIEW,
    StageType.DOCUMENT_VERIFICATION,
    StageType.KYC,
    StageType.PLACEMENT,
]

_CONTACT_OUTCOMES = {
    "connected",
    "no_answer",
    "wrong_number",
    "phone_switched_off",
    "call_back_later",
    "candidate_not_interested",
    "other",
}
_ACTIVE_STATUSES = {
    ApplicationStatus.INTERESTED,
    ApplicationStatus.CONTACT_ATTEMPTED,
    ApplicationStatus.CONTACT_SUCCESSFUL,
    ApplicationStatus.UNABLE_TO_REACH,
    ApplicationStatus.NOT_INTERESTED,
    ApplicationStatus.ASSIGNED,
    ApplicationStatus.CONTACT_PENDING,
    ApplicationStatus.SCREENING,
    ApplicationStatus.IN_INTERVIEW,
    ApplicationStatus.DOCUMENTS,
    ApplicationStatus.KYC,
    ApplicationStatus.VALIDATED,
    ApplicationStatus.SELECTED,
    ApplicationStatus.BLOCKED_FOR_POSITION,
    ApplicationStatus.QUALIFIED,
}

_ROLE_ALIASES = {
    "quality inspector": ("quality control", "quality assurance", "quality inspection"),
}


def _ensure_application_access(app_row: Application, current_user: User) -> None:
    if current_user.role.name == RoleName.RECRUITER and app_row.assigned_recruiter_id != current_user.id:
        raise HTTPException(status_code=403, detail="Application is assigned to another recruiter")


def _release_to_pool(db: Session, app_row: Application, reason: str) -> None:
    candidate = db.get(Candidate, app_row.candidate_id)
    if candidate:
        candidate.pool_status = CandidatePoolStatus.AVAILABLE
        candidate.status = CandidateStatus.NEW
    app_row.status = ApplicationStatus.RELEASED
    app_row.released_at = datetime.now(timezone.utc)
    app_row.release_reason = reason


def _required_documents(job: JobPosting) -> list[str]:
    required = job.documents_required or {}
    if isinstance(required, list):
        return [str(item) for item in required]
    if isinstance(required, dict):
        for key in ("items", "documents", "required"):
            if isinstance(required.get(key), list):
                return [str(item) for item in required[key]]
    return []


def _values(value: object) -> list[str]:
    if isinstance(value, list):
        return [str(item).lower() for item in value]
    if isinstance(value, dict):
        for key in ("items", "skills", "values", "required"):
            if isinstance(value.get(key), list):
                return [str(item).lower() for item in value[key]]
    return []


def _normalized_phrase(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value or "").strip().lower()


def _matches_job_role(
    job: JobPosting,
    candidate: Candidate,
    required_skills: list[str],
) -> tuple[bool, list[str]]:
    job_title = _normalized_phrase(job.title)
    candidate_trade = _normalized_phrase(candidate.primary_trade)
    profile_data = candidate.profile_data or {}
    candidate_skills = _values(profile_data.get("skills"))
    work_experience = profile_data.get("work_experience") or {}
    candidate_roles = [
        candidate_trade,
        _normalized_phrase(work_experience.get("current_role")),
        _normalized_phrase(profile_data.get("preferred_job_role")),
    ]
    matched_skills = [skill for skill in required_skills if skill in candidate_skills]
    trade_match = bool(
        candidate_trade
        and job_title
        and (candidate_trade in job_title or job_title in candidate_trade)
    )
    aliases = _ROLE_ALIASES.get(job_title, ())
    candidate_role_text = " ".join(candidate_roles + candidate_skills)
    alias_match = any(alias in candidate_role_text for alias in aliases)
    quality_control_match = (
        job_title == "quality inspector" and "quality control" in candidate_skills
    )
    return trade_match or alias_match or quality_control_match or bool(matched_skills), matched_skills


@router.get("/screening/jobs/{job_id}", response_model=list[ScreeningMatch])
def screen_candidates_for_job(
    job_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(_MGR_ADMIN),
):
    job = db.get(JobPosting, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status not in (JobStatus.APPROVED, JobStatus.PUBLISHED):
        raise HTTPException(status_code=400, detail="Select an approved job for screening")

    required_skills = _values(job.required_skills)
    matches: list[ScreeningMatch] = []
    for candidate in db.scalars(select(Candidate).where(
        Candidate.pool_status == CandidatePoolStatus.AVAILABLE,
        Candidate.status.notin_([
            CandidateStatus.PLACED, CandidateStatus.REJECTED, CandidateStatus.BLACKLISTED,
        ]),
    )).all():
        role_match, skill_matches = _matches_job_role(job, candidate, required_skills)
        candidate_skills = _values((candidate.profile_data or {}).get("skills"))
        if job.title == "Quality Inspector" and "quality control" in candidate_skills:
            role_match = True
            skill_matches = ["quality control"]
        if not role_match:
            continue

        score = 0
        reasons: list[str] = []
        candidate_trade = _normalized_phrase(candidate.primary_trade)
        if candidate_trade and candidate_trade in _normalized_phrase(job.title):
            score += 35
            reasons.append("matching trade")
        elif job.title == "Quality Inspector" and "quality control" in candidate_skills:
            score += 35
            reasons.append("relevant skill: quality control")
        if job.work_state and candidate.state and candidate.state.lower() == job.work_state.lower():
            score += 15
            reasons.append("same state")
        if job.work_city and candidate.city and candidate.city.lower() == job.work_city.lower():
            score += 15
            reasons.append("same city")
        if (candidate.experience_years or 0) >= job.min_experience_years:
            score += 15
            reasons.append("experience requirement met")
        if job.min_qualification and candidate.education_level:
            score += 5
            reasons.append("education available")
        if skill_matches:
            score += min(15, len(skill_matches) * 5)
            reasons.append(f"skills: {', '.join(skill_matches)}")
        if score:
            matches.append(ScreeningMatch(
                candidate_id=candidate.id,
                full_name=candidate.full_name,
                primary_trade=candidate.primary_trade,
                city=candidate.city,
                state=candidate.state,
                experience_years=candidate.experience_years,
                education_level=candidate.education_level,
                score=score,
                reasons=reasons,
            ))
    return sorted(matches, key=lambda match: (-match.score, match.full_name))


# ---- Screening questions (admin config) ----
@router.get("/screening-questions", response_model=list[ScreeningQuestionOut])
def list_questions(db: Session = Depends(get_db), _: User = Depends(_STAFF)):
    return db.scalars(
        select(ScreeningQuestion).order_by(ScreeningQuestion.order_index)
    ).all()


@router.post("/screening-questions", response_model=ScreeningQuestionOut, status_code=201)
def create_question(
    body: ScreeningQuestionCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleName.ADMIN)),
):
    q = ScreeningQuestion(**body.model_dump())
    db.add(q)
    db.commit()
    db.refresh(q)
    return q


@router.get("/interview-stages", response_model=list[StageConfigOut])
def list_stages(db: Session = Depends(get_db), _: User = Depends(_STAFF)):
    return db.scalars(
        select(InterviewStageConfig).order_by(InterviewStageConfig.order_index)
    ).all()


# ---- Applications ----
@router.post("/applications", response_model=ApplicationOut, status_code=201)
def create_application(
    body: ApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_MGR_ADMIN),
):
    exists = db.scalar(
        select(Application).where(
            Application.candidate_id == body.candidate_id,
            Application.status.in_(_ACTIVE_STATUSES),
        )
    )
    if exists:
        raise HTTPException(status_code=409, detail="Candidate is already in an active recruitment process")

    candidate = db.get(Candidate, body.candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    app_row = Application(
        candidate_id=body.candidate_id,
        job_id=body.job_id,
        assigned_recruiter_id=body.assigned_recruiter_id,
        assigned_by_id=current_user.id,
        status=ApplicationStatus.CONTACT_PENDING,
    )
    db.add(app_row)
    if candidate.pool_status == CandidatePoolStatus.AVAILABLE:
        candidate.pool_status = CandidatePoolStatus.RESERVED

    record_audit(
        db, user_id=current_user.id, action="application.create",
        entity_type="application", entity_id=None, commit=False,
    )
    db.commit()
    db.refresh(app_row)
    return app_row


@router.post("/applications/interest", response_model=ApplicationOut, status_code=201)
def register_interest(
    body: ApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_STAFF),
):
    """Record candidate interest in a job from any source (website, social, agent, etc.)."""
    candidate = db.get(Candidate, body.candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    existing = db.scalar(
        select(Application).where(
            Application.candidate_id == body.candidate_id,
            Application.job_id == body.job_id,
            Application.status.in_(_ACTIVE_STATUSES),
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="Candidate has already expressed interest in this job")

    app_row = Application(
        candidate_id=body.candidate_id,
        job_id=body.job_id,
        assigned_recruiter_id=body.assigned_recruiter_id,
        assigned_by_id=current_user.id,
        status=ApplicationStatus.INTERESTED,
        candidate_interest=True,
        interest_recorded_at=datetime.now(timezone.utc),
    )
    db.add(app_row)
    if candidate.pool_status == CandidatePoolStatus.AVAILABLE:
        candidate.pool_status = CandidatePoolStatus.RESERVED

    record_audit(
        db, user_id=current_user.id, action="application.interest",
        entity_type="application", entity_id=None, detail="interested", commit=False,
    )
    db.commit()
    db.refresh(app_row)
    return app_row


@router.get("/applications/{application_id}/contact-attempts", response_model=list[ContactAttemptOut])
def list_contact_attempts(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_STAFF),
):
    app_row = db.get(Application, application_id)
    if not app_row:
        raise HTTPException(status_code=404, detail="Application not found")
    _ensure_application_access(app_row, current_user)
    return db.scalars(
        select(RecruiterContactAttempt)
        .where(RecruiterContactAttempt.application_id == application_id)
        .order_by(RecruiterContactAttempt.attempted_at)
    ).all()


@router.post("/applications/{application_id}/contact-attempts", response_model=ApplicationOut)
def record_contact_attempt(
    application_id: int,
    body: ContactAttemptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_STAFF),
):
    app_row = db.get(Application, application_id)
    if not app_row:
        raise HTTPException(status_code=404, detail="Application not found")
    _ensure_application_access(app_row, current_user)
    if current_user.role.name != RoleName.RECRUITER:
        raise HTTPException(status_code=403, detail="Only the assigned recruiter can record contact attempts")
    if app_row.status not in (
        ApplicationStatus.INTERESTED,
        ApplicationStatus.CONTACT_ATTEMPTED,
        ApplicationStatus.UNABLE_TO_REACH,
        ApplicationStatus.ASSIGNED,
        ApplicationStatus.CONTACT_PENDING,
    ):
        raise HTTPException(status_code=400, detail="Contact attempts are no longer available for this application")
    if body.outcome not in _CONTACT_OUTCOMES:
        raise HTTPException(status_code=400, detail="Unsupported contact outcome")
    if body.outcome == "other" and not (body.notes or "").strip():
        raise HTTPException(status_code=400, detail="Notes are required for the Other outcome")
    if db.scalar(select(RecruiterContactAttempt.id).where(
        RecruiterContactAttempt.application_id == app_row.id,
        RecruiterContactAttempt.outcome == "connected",
    )):
        raise HTTPException(status_code=400, detail="Record the candidate interest decision after a successful contact")

    db.add(RecruiterContactAttempt(
        application_id=app_row.id,
        recruiter_id=current_user.id,
        outcome=body.outcome,
        notes=body.notes,
        attempted_at=datetime.now(timezone.utc),
    ))
    app_row.contact_attempt_count += 1
    if body.outcome == "candidate_not_interested":
        app_row.status = ApplicationStatus.NOT_INTERESTED
        app_row.candidate_interest = False
        _release_to_pool(db, app_row, body.notes or "Candidate not interested")
    elif body.outcome == "connected":
        app_row.status = ApplicationStatus.CONTACT_SUCCESSFUL
    else:
        app_row.status = ApplicationStatus.CONTACT_ATTEMPTED if app_row.contact_attempt_count < 3 else ApplicationStatus.UNABLE_TO_REACH
        if app_row.contact_attempt_count >= 3:
            _release_to_pool(db, app_row, "Three unsuccessful contact attempts")
    record_audit(
        db, user_id=current_user.id, action="application.contact_attempt",
        entity_type="application", entity_id=app_row.id, detail=body.outcome, commit=False,
    )
    db.commit()
    db.refresh(app_row)
    return app_row


@router.post("/applications/{application_id}/interest", response_model=ApplicationOut)
def record_candidate_interest(
    application_id: int,
    body: CandidateInterestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(_STAFF),
):
    app_row = db.get(Application, application_id)
    if not app_row:
        raise HTTPException(status_code=404, detail="Application not found")
    _ensure_application_access(app_row, current_user)
    if current_user.role.name != RoleName.RECRUITER:
        raise HTTPException(status_code=403, detail="Only the assigned recruiter can record candidate interest")
    if app_row.status not in (
        ApplicationStatus.INTERESTED,
        ApplicationStatus.CONTACT_ATTEMPTED,
        ApplicationStatus.CONTACT_SUCCESSFUL,
        ApplicationStatus.ASSIGNED,
        ApplicationStatus.CONTACT_PENDING,
    ):
        raise HTTPException(status_code=400, detail="Candidate interest is already recorded for this application")
    connected = db.scalar(
        select(RecruiterContactAttempt.id).where(
            RecruiterContactAttempt.application_id == app_row.id,
            RecruiterContactAttempt.outcome == "connected",
        )
    )
    if not connected:
        raise HTTPException(status_code=400, detail="Record a successful contact before recording interest")
    app_row.candidate_interest = body.interested
    app_row.interest_recorded_at = datetime.now(timezone.utc)
    if body.interested:
        app_row.status = ApplicationStatus.SCREENING
        candidate = db.get(Candidate, app_row.candidate_id)
        if candidate:
            candidate.pool_status = CandidatePoolStatus.IN_PROCESS
            candidate.status = CandidateStatus.IN_PROCESS
    else:
        app_row.status = ApplicationStatus.NOT_INTERESTED
        _release_to_pool(db, app_row, body.notes or "Candidate not interested")
    record_audit(
        db, user_id=current_user.id, action="application.interest",
        entity_type="application", entity_id=app_row.id,
        detail="interested" if body.interested else "not_interested", commit=False,
    )
    db.commit()
    db.refresh(app_row)
    return app_row


@router.post("/applications/{application_id}/qualify", response_model=ApplicationOut)
def qualify_application(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_STAFF),
):
    """Mark an application as qualified / blocked for the position."""
    app_row = db.get(Application, application_id)
    if not app_row:
        raise HTTPException(status_code=404, detail="Application not found")
    _ensure_application_access(app_row, current_user)
    if app_row.status in (ApplicationStatus.RELEASED, ApplicationStatus.PLACED, ApplicationStatus.REJECTED):
        raise HTTPException(status_code=400, detail="This application is already closed")
    app_row.status = ApplicationStatus.BLOCKED_FOR_POSITION
    app_row.blocked_for_position_at = datetime.now(timezone.utc)
    candidate = db.get(Candidate, app_row.candidate_id)
    if candidate:
        candidate.pool_status = CandidatePoolStatus.RESERVED
        candidate.status = CandidateStatus.SHORTLISTED
    record_audit(
        db, user_id=current_user.id, action="application.qualify",
        entity_type="application", entity_id=app_row.id, detail="blocked_for_position", commit=False,
    )
    db.commit()
    db.refresh(app_row)
    return app_row


@router.get("/applications/{application_id}/screening-responses", response_model=list[ScreeningResponseOut])
def list_screening_responses(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_STAFF),
):
    app_row = db.get(Application, application_id)
    if not app_row:
        raise HTTPException(status_code=404, detail="Application not found")
    _ensure_application_access(app_row, current_user)
    return db.scalars(
        select(ScreeningResponse)
        .where(ScreeningResponse.application_id == application_id)
        .order_by(ScreeningResponse.question_id)
    ).all()


@router.put("/applications/{application_id}/screening-responses", response_model=list[ScreeningResponseOut])
def save_screening_responses(
    application_id: int,
    body: ScreeningResponsesSave,
    db: Session = Depends(get_db),
    current_user: User = Depends(_STAFF),
):
    app_row = db.get(Application, application_id)
    if not app_row:
        raise HTTPException(status_code=404, detail="Application not found")
    _ensure_application_access(app_row, current_user)
    if app_row.status != ApplicationStatus.SCREENING:
        raise HTTPException(status_code=400, detail="Candidate is not ready for screening")
    active_question_ids = set(db.scalars(
        select(ScreeningQuestion.id).where(ScreeningQuestion.is_active.is_(True))
    ).all())
    submitted = {response.question_id: response.answer.strip() for response in body.responses}
    if set(submitted) != active_question_ids or any(not answer for answer in submitted.values()):
        raise HTTPException(status_code=400, detail="Answer every active screening question")
    existing = {
        response.question_id: response
        for response in db.scalars(
            select(ScreeningResponse).where(ScreeningResponse.application_id == app_row.id)
        ).all()
    }
    now = datetime.now(timezone.utc)
    for question_id, answer in submitted.items():
        if question_id in existing:
            existing[question_id].answer = answer
            existing[question_id].answered_by_id = current_user.id
            existing[question_id].answered_at = now
        else:
            db.add(ScreeningResponse(
                application_id=app_row.id,
                question_id=question_id,
                answer=answer,
                answered_by_id=current_user.id,
                answered_at=now,
            ))
    db.commit()
    return db.scalars(
        select(ScreeningResponse).where(ScreeningResponse.application_id == app_row.id)
    ).all()


@router.get("/applications", response_model=list[ApplicationOut])
def list_applications(
    job_id: int | None = None,
    candidate_id: int | None = None,
    recruiter_id: int | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(_STAFF),
):
    stmt = select(Application).order_by(Application.created_at.desc())
    if job_id:
        stmt = stmt.where(Application.job_id == job_id)
    if candidate_id:
        stmt = stmt.where(Application.candidate_id == candidate_id)
    if recruiter_id:
        stmt = stmt.where(Application.assigned_recruiter_id == recruiter_id)
    if current_user.role.name == RoleName.RECRUITER:
        stmt = stmt.where(Application.assigned_recruiter_id == current_user.id)
    if status:
        stmt = stmt.where(Application.status == status)
    return db.scalars(stmt).all()


@router.post("/applications/{application_id}/assign", response_model=ApplicationOut)
def assign_recruiter(
    application_id: int,
    body: AssignRecruiter,
    db: Session = Depends(get_db),
    current_user: User = Depends(_MGR_ADMIN),
):
    app_row = db.get(Application, application_id)
    if not app_row:
        raise HTTPException(status_code=404, detail="Application not found")
    app_row.assigned_recruiter_id = body.assigned_recruiter_id
    app_row.assigned_by_id = current_user.id
    db.commit()
    db.refresh(app_row)
    return app_row


@router.get("/applications/{application_id}/evaluations", response_model=list[EvaluationOut])
def list_evaluations(
    application_id: int, db: Session = Depends(get_db), current_user: User = Depends(_STAFF)
):
    app_row = db.get(Application, application_id)
    if not app_row:
        raise HTTPException(status_code=404, detail="Application not found")
    _ensure_application_access(app_row, current_user)
    return db.scalars(
        select(StageEvaluation)
        .where(StageEvaluation.application_id == application_id)
        .order_by(StageEvaluation.created_at)
    ).all()


@router.post("/applications/{application_id}/evaluations", response_model=EvaluationOut)
def record_evaluation(
    application_id: int,
    body: EvaluationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_STAFF),
):
    app_row = db.get(Application, application_id)
    if not app_row:
        raise HTTPException(status_code=404, detail="Application not found")
    _ensure_application_access(app_row, current_user)
    if app_row.status in (ApplicationStatus.RELEASED, ApplicationStatus.PLACED):
        raise HTTPException(status_code=400, detail="This application is already closed")
    if body.stage_type != app_row.current_stage_type:
        raise HTTPException(status_code=400, detail="Record the evaluation for the current stage")
    if body.outcome == StageOutcome.PASSED and body.stage_type == StageType.SCREENING:
        active_question_count = db.scalar(
            select(InterviewStageConfig.id).where(InterviewStageConfig.stage_type == StageType.SCREENING)
        )
        response_count = len(db.scalars(
            select(ScreeningResponse.id).where(ScreeningResponse.application_id == app_row.id)
        ).all())
        question_count = len(db.scalars(
            select(ScreeningQuestion.id).where(ScreeningQuestion.is_active.is_(True))
        ).all())
        if active_question_count and response_count != question_count:
            raise HTTPException(status_code=400, detail="Answer every screening question before passing the stage")

    if body.outcome == StageOutcome.PASSED and body.stage_type in (
        StageType.DOCUMENT_VERIFICATION,
        StageType.KYC,
    ):
        job = db.get(JobPosting, app_row.job_id)
        required_documents = _required_documents(job) if job else []
        if required_documents:
            verified_documents = set(db.scalars(
                select(KycDocument.document_type).where(
                    KycDocument.candidate_id == app_row.candidate_id,
                    KycDocument.status == "verified",
                )
            ).all())
            missing = [document for document in required_documents if document not in verified_documents]
            if missing:
                raise HTTPException(
                    status_code=400,
                    detail=f"Required verified documents are missing: {', '.join(missing)}",
                )

    evaluation = StageEvaluation(
        application_id=application_id,
        stage_type=body.stage_type,
        outcome=body.outcome,
        score=body.score,
        remarks=body.remarks,
        evaluated_by_id=current_user.id,
        evaluated_at=datetime.now(timezone.utc),
    )
    db.add(evaluation)

    if body.outcome == StageOutcome.PASSED:
        idx = _STAGE_ORDER.index(body.stage_type)
        if idx + 1 < len(_STAGE_ORDER):
            app_row.current_stage_type = _STAGE_ORDER[idx + 1]
            next_stage = app_row.current_stage_type
            if next_stage == StageType.CLIENT_INTERVIEW:
                app_row.status = ApplicationStatus.IN_INTERVIEW
            elif next_stage == StageType.DOCUMENT_VERIFICATION:
                app_row.status = ApplicationStatus.DOCUMENTS
            elif next_stage == StageType.KYC:
                app_row.status = ApplicationStatus.KYC
            elif next_stage == StageType.PLACEMENT:
                app_row.status = ApplicationStatus.VALIDATED
        else:
            app_row.status = ApplicationStatus.PLACED
            candidate = db.get(Candidate, app_row.candidate_id)
            if candidate:
                candidate.status = CandidateStatus.PLACED
                candidate.pool_status = CandidatePoolStatus.PLACED
    elif body.outcome == StageOutcome.FAILED:
        _release_to_pool(db, app_row, body.remarks or f"{body.stage_type.value} not cleared")
    elif body.outcome == StageOutcome.ON_HOLD:
        app_row.status = ApplicationStatus.ON_HOLD

    record_audit(
        db, user_id=current_user.id, action="application.stage_evaluation",
        entity_type="application", entity_id=app_row.id,
        detail=f"{body.stage_type.value}:{body.outcome.value}", commit=False,
    )
    db.commit()
    db.refresh(evaluation)
    return evaluation
