from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.core.enums import (
    ApplicationStatus,
    CandidateStatus,
    RoleName,
    StageOutcome,
    StageType,
)
from app.db.session import get_db
from app.models.candidate import Candidate
from app.models.pipeline import (
    Application,
    InterviewStageConfig,
    ScreeningQuestion,
    StageEvaluation,
)
from app.models.user import User
from app.schemas.pipeline import (
    ApplicationCreate,
    ApplicationOut,
    AssignRecruiter,
    EvaluationCreate,
    EvaluationOut,
    ScreeningQuestionCreate,
    ScreeningQuestionOut,
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
    StageType.PLACEMENT,
]


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
            Application.job_id == body.job_id,
        )
    )
    if exists:
        raise HTTPException(status_code=409, detail="Candidate already assigned to this job")

    app_row = Application(
        candidate_id=body.candidate_id,
        job_id=body.job_id,
        assigned_recruiter_id=body.assigned_recruiter_id,
        assigned_by_id=current_user.id,
    )
    db.add(app_row)

    candidate = db.get(Candidate, body.candidate_id)
    if candidate:
        candidate.status = CandidateStatus.IN_PROCESS

    record_audit(
        db, user_id=current_user.id, action="application.create",
        entity_type="application", entity_id=None, commit=False,
    )
    db.commit()
    db.refresh(app_row)
    return app_row


@router.get("/applications", response_model=list[ApplicationOut])
def list_applications(
    job_id: int | None = None,
    candidate_id: int | None = None,
    recruiter_id: int | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(_STAFF),
):
    stmt = select(Application).order_by(Application.created_at.desc())
    if job_id:
        stmt = stmt.where(Application.job_id == job_id)
    if candidate_id:
        stmt = stmt.where(Application.candidate_id == candidate_id)
    if recruiter_id:
        stmt = stmt.where(Application.assigned_recruiter_id == recruiter_id)
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
    application_id: int, db: Session = Depends(get_db), _: User = Depends(_STAFF)
):
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

    app_row.status = ApplicationStatus.IN_INTERVIEW
    if body.outcome == StageOutcome.PASSED:
        idx = _STAGE_ORDER.index(body.stage_type)
        if idx + 1 < len(_STAGE_ORDER):
            app_row.current_stage_type = _STAGE_ORDER[idx + 1]
        else:
            app_row.status = ApplicationStatus.PLACED
            candidate = db.get(Candidate, app_row.candidate_id)
            if candidate:
                candidate.status = CandidateStatus.PLACED
        if body.stage_type == StageType.CLIENT_INTERVIEW:
            app_row.status = ApplicationStatus.SELECTED
    elif body.outcome == StageOutcome.FAILED:
        app_row.status = ApplicationStatus.REJECTED

    db.commit()
    db.refresh(evaluation)
    return evaluation
