from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.enums import (
    ApplicationStatus,
    CandidateSource,
    CandidateStatus,
    JobStatus,
    KycStatus,
    RoleName,
)
from app.db.session import get_db
from app.models.audit import AgentLocationLog
from app.models.candidate import Candidate
from app.models.job import JobPosting
from app.models.kyc import KycDocument
from app.models.org import Institution, Employer, InstitutionUploadLog
from app.models.pipeline import Application
from app.models.user import User, Role
from app.schemas.dashboard import DashboardOut, KpiCard

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _count(db: Session, model, *conditions) -> int:
    stmt = select(func.count()).select_from(model)
    for c in conditions:
        stmt = stmt.where(c)
    return db.scalar(stmt) or 0


def _count_users_by_role(db: Session, role_name: RoleName) -> int:
    """Count users with a specific role by joining with Role table."""
    stmt = (
        select(func.count())
        .select_from(User)
        .join(Role)
        .where(Role.name == role_name)
    )
    return db.scalar(stmt) or 0


def _count_candidates_today(db: Session, agent_id: int) -> int:
    """Count candidates registered today by a field agent."""
    today = date.today()
    stmt = select(func.count()).select_from(Candidate).where(
        and_(
            Candidate.registered_by_id == agent_id,
            func.date(Candidate.created_at) == today,
        )
    )
    return db.scalar(stmt) or 0


def _count_candidates_this_month(db: Session, agent_id: int) -> int:
    """Count candidates registered this month by a field agent."""
    today = date.today()
    month_start = date(today.year, today.month, 1)
    stmt = select(func.count()).select_from(Candidate).where(
        and_(
            Candidate.registered_by_id == agent_id,
            func.date(Candidate.created_at) >= month_start,
        )
    )
    return db.scalar(stmt) or 0


def _recent_uploads(db: Session, institution_id: int) -> int:
    today = date.today()
    month_start = date(today.year, today.month, 1)
    stmt = (
        select(func.count())
        .select_from(InstitutionUploadLog)
        .where(
            and_(
                InstitutionUploadLog.institution_id == institution_id,
                func.date(InstitutionUploadLog.created_at) >= month_start,
            )
        )
    )
    return db.scalar(stmt) or 0


def _last_upload_status(db: Session, institution_id: int) -> str | None:
    stmt = (
        select(InstitutionUploadLog.status)
        .where(InstitutionUploadLog.institution_id == institution_id)
        .order_by(InstitutionUploadLog.created_at.desc())
        .limit(1)
    )
    return db.scalar(stmt)


@router.get("", response_model=DashboardOut)
def dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    role = current_user.role.name
    cards: list[KpiCard] = []

    if role in (RoleName.ADMIN.value, RoleName.MANAGER.value):
        cards = [
            KpiCard(
                label="Total Candidates",
                value=_count(db, Candidate),
                link="/candidates",
            ),
            KpiCard(
                label="Placed",
                value=_count(db, Candidate, Candidate.status == CandidateStatus.PLACED),
                link="/candidates?status=placed",
            ),
            KpiCard(
                label="Jobs Pending Approval",
                value=_count(db, JobPosting, JobPosting.status == JobStatus.PENDING_APPROVAL),
                link="/jobs?status=pending_approval",
            ),
            KpiCard(
                label="Published Jobs",
                value=_count(db, JobPosting, JobPosting.status == JobStatus.PUBLISHED),
                link="/jobs?status=published",
            ),
            KpiCard(
                label="Admins",
                value=_count_users_by_role(db, RoleName.ADMIN),
                link="/admin/users?role=admin",
            ),
            KpiCard(
                label="Managers",
                value=_count_users_by_role(db, RoleName.MANAGER),
                link="/admin/users?role=manager",
            ),
            KpiCard(
                label="Recruiters",
                value=_count_users_by_role(db, RoleName.RECRUITER),
                link="/admin/users?role=recruiter",
            ),
            KpiCard(
                label="Field Agents",
                value=_count_users_by_role(db, RoleName.FIELD_AGENT),
                link="/admin/users?role=field_agent",
            ),
            KpiCard(
                label="Institutions",
                value=_count(db, Institution),
                link="/institutions",
            ),
            KpiCard(
                label="Employers",
                value=_count(db, Employer),
                link="/employers",
            ),
        ]
    elif role == RoleName.RECRUITER.value:
        cards = [
            KpiCard(
                label="My Assignments",
                value=_count(
                    db, Application, Application.assigned_recruiter_id == current_user.id
                ),
                link="/assignments",
            ),
            KpiCard(
                label="In Interview",
                value=_count(
                    db,
                    Application,
                    Application.assigned_recruiter_id == current_user.id,
                    Application.status == ApplicationStatus.IN_INTERVIEW,
                ),
                link="/assignments?status=in_interview",
            ),
            KpiCard(
                label="Selected",
                value=_count(
                    db,
                    Application,
                    Application.assigned_recruiter_id == current_user.id,
                    Application.status == ApplicationStatus.SELECTED,
                ),
                link="/assignments?status=selected",
            ),
            KpiCard(
                label="KYC Pending",
                value=_count(db, KycDocument, KycDocument.status == KycStatus.SUBMITTED),
                link="/kyc",
            ),
        ]
    elif role == RoleName.FIELD_AGENT.value:
        cards = [
            KpiCard(
                label="Candidates Registered",
                value=_count(db, Candidate, Candidate.registered_by_id == current_user.id),
                link="/candidates",
            ),
            KpiCard(
                label="Registered Today",
                value=_count_candidates_today(db, current_user.id),
                link="/candidates",
            ),
            KpiCard(
                label="Registered This Month",
                value=_count_candidates_this_month(db, current_user.id),
                link="/candidates",
            ),
            KpiCard(
                label="Location Check-ins",
                value=_count(
                    db, AgentLocationLog, AgentLocationLog.field_agent_id == current_user.id
                ),
                link="/field/checkin",
            ),
        ]
    elif role == RoleName.INSTITUTION.value:
        inst_id = current_user.institution_id
        inst_upload_filter = and_(
            Candidate.institution_id == inst_id,
            Candidate.source == CandidateSource.INSTITUTION_UPLOAD,
        )
        cards = [
            KpiCard(
                label="Total Candidates Uploaded",
                value=_count(db, Candidate, inst_upload_filter),
                hint="Students shared with Layam Group",
                link="/institution/candidates",
            ),
            KpiCard(
                label="Placed from Institute",
                value=_count(
                    db,
                    Candidate,
                    inst_upload_filter,
                    Candidate.status == CandidateStatus.PLACED,
                ),
                hint="Successfully placed candidates",
                link="/institution/candidates?status=placed",
            ),
            KpiCard(
                label="In Process / Shortlisted",
                value=_count(
                    db,
                    Candidate,
                    inst_upload_filter,
                    Candidate.status.in_([CandidateStatus.IN_PROCESS, CandidateStatus.SHORTLISTED]),
                ),
                hint="Active in recruitment pipeline",
                link="/institution/candidates",
            ),
            KpiCard(
                label="Awaiting Screening",
                value=_count(
                    db, Candidate, inst_upload_filter, Candidate.status == CandidateStatus.NEW
                ),
                hint="Yet to be contacted by recruiters",
                link="/institution/candidates?status=new",
            ),
            KpiCard(
                label="Recent Uploads",
                value=_recent_uploads(db, inst_id),
                hint="Uploads this month",
                link="/institution/uploads",
            ),
            KpiCard(
                label="Last Upload Status",
                value=1,
                hint=(_last_upload_status(db, inst_id) or "No uploads").replace("_", " ").title(),
                link="/institution/uploads",
            ),
        ]
    elif role == RoleName.EMPLOYER.value:
        cards = [
            KpiCard(
                label="Our Job Postings",
                value=_count(db, JobPosting, JobPosting.employer_id == current_user.employer_id),
                link="/jobs",
            ),
            KpiCard(
                label="Published",
                value=_count(
                    db,
                    JobPosting,
                    JobPosting.employer_id == current_user.employer_id,
                    JobPosting.status == JobStatus.PUBLISHED,
                ),
                link="/jobs?status=published",
            ),
        ]

    return DashboardOut(role=role, cards=cards)
