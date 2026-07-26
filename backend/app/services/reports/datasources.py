"""Whitelist of tables and columns available in the reporting engine.

Never introspect models dynamically — every reportable column is declared
here so we can enforce role-based PII masking and prevent injection.

Each data source specifies:
    * ``key``         — the API/URL identifier (kebab or snake).
    * ``label``       — human-friendly name.
    * ``model``       — the SQLAlchemy model class the query starts from.
    * ``description`` — optional help text.
    * ``joins``       — list of extra models to left-join (each entry declares
      how to join and which columns become available with a prefix).
    * ``columns``     — list of :class:`Column` describing each field.

A column has:
    * ``name``            — key returned in the row (may include a join prefix
      separated by ``.``, e.g. ``employer.company_name``).
    * ``label``           — display label.
    * ``type``            — one of string/number/date/datetime/bool/enum.
    * ``sql``             — the SQLAlchemy column expression to select.
    * ``filterable``      — whether it can be used in a filter clause.
    * ``group_by_ok``     — whether it can be used in group-by.
    * ``aggregate_ok``    — whether numeric aggregates can be applied.
    * ``is_pii``          — whether it contains PII (subject to masking).
    * ``enum_choices``    — for enum columns, the picker options.
    * ``latitude`` / ``longitude`` — marker fields (used by map view detection).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from sqlalchemy.orm import aliased
from sqlalchemy.sql.elements import ColumnElement

from app.models.audit import AgentLocationLog, AuditLog, PiiAccessLog
from app.models.candidate import Candidate
from app.models.job import JobApproval, JobPosting
from app.models.kyc import KycDocument
from app.models.lead import LeadInbound
from app.models.org import Employer, Institution
from app.models.pipeline import (
    Application,
    InterviewStageConfig,
    ScreeningQuestion,
    StageEvaluation,
)
from app.models.user import Role, User


@dataclass(frozen=True)
class ReportColumn:
    name: str
    label: str
    type: str  # string|number|date|datetime|bool|enum
    sql: Any  # SQLAlchemy column expression
    filterable: bool = True
    group_by_ok: bool = True
    aggregate_ok: bool = False
    is_pii: bool = False
    enum_choices: Optional[list[str]] = None


@dataclass(frozen=True)
class Join:
    """A predeclared join to enrich the base query."""

    target: Any  # SQLAlchemy model class or aliased()
    onclause: Any  # SQL expression
    isouter: bool = True


@dataclass(frozen=True)
class DataSource:
    key: str
    label: str
    model: Any
    description: str = ""
    joins: dict[str, Join] = field(default_factory=dict)  # alias_key -> Join
    columns: list[ReportColumn] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Enum choice helpers (avoid importing enums repeatedly)
# ---------------------------------------------------------------------------

def _enum_values(enum_cls) -> list[str]:
    return [e.value if hasattr(e, "value") else str(e) for e in enum_cls]


# ---------------------------------------------------------------------------
# Aliases for joins (declared once so column refs stay stable)
# ---------------------------------------------------------------------------

# For Candidates → Institution (institution_id)
CandInstitution = aliased(Institution, name="cand_institution")
# For Candidates → User registered_by
CandRegisteredBy = aliased(User, name="cand_registered_by")
# For Jobs → Employer
JobEmployer = aliased(Employer, name="job_employer")
# For Jobs → User created_by / assigned_recruiter
JobCreator = aliased(User, name="job_creator")
JobRecruiter = aliased(User, name="job_recruiter")
# For Applications → Candidate + Job + Recruiter
AppCandidate = aliased(Candidate, name="app_candidate")
AppJob = aliased(JobPosting, name="app_job")
AppRecruiter = aliased(User, name="app_recruiter")
# For StageEvaluations → Application (needed to reach candidate/job through parent)
EvalApp = aliased(Application, name="eval_app")
EvalUser = aliased(User, name="eval_user")
# For Users → Role
UserRole = aliased(Role, name="user_role")
# For AgentLocationLogs → User
LocUser = aliased(User, name="loc_user")
# For AuditLogs / PiiAccessLogs → User
AuditUser = aliased(User, name="audit_user")
PiiUser = aliased(User, name="pii_user")
PiiCandidate = aliased(Candidate, name="pii_candidate")
# For KycDocuments → Candidate
KycCandidate = aliased(Candidate, name="kyc_candidate")
KycVerifier = aliased(User, name="kyc_verifier")
# For LeadInbound → Candidate (promoted)
LeadCandidate = aliased(Candidate, name="lead_candidate")


# ---------------------------------------------------------------------------
# Data sources
# ---------------------------------------------------------------------------

CANDIDATES = DataSource(
    key="candidates",
    label="Candidates",
    model=Candidate,
    description="Blue-collar worker profiles in the data bank.",
    joins={
        "institution": Join(CandInstitution, Candidate.institution_id == CandInstitution.id),
        "registered_by": Join(
            CandRegisteredBy, Candidate.registered_by_id == CandRegisteredBy.id
        ),
    },
    columns=[
        ReportColumn("id", "ID", "number", Candidate.id, aggregate_ok=True),
        ReportColumn("full_name", "Full Name", "string", Candidate.full_name),
        ReportColumn("gender", "Gender", "string", Candidate.gender),
        ReportColumn("date_of_birth", "Date of Birth", "date", Candidate.date_of_birth),
        ReportColumn("phone", "Phone", "string", Candidate.phone, is_pii=True),
        ReportColumn("email", "Email", "string", Candidate.email, is_pii=True),
        ReportColumn("address", "Address", "string", Candidate.address, is_pii=True),
        ReportColumn("city", "City", "string", Candidate.city),
        ReportColumn("state", "State", "string", Candidate.state),
        ReportColumn("pincode", "Pincode", "string", Candidate.pincode),
        ReportColumn("primary_trade", "Primary Trade", "string", Candidate.primary_trade),
        ReportColumn(
            "experience_years", "Experience (yrs)", "number",
            Candidate.experience_years, aggregate_ok=True,
        ),
        ReportColumn("education_level", "Education", "string", Candidate.education_level),
        ReportColumn("certification", "Certification", "string", Candidate.certification),
        ReportColumn(
            "expected_salary", "Expected Salary", "number",
            Candidate.expected_salary, aggregate_ok=True,
        ),
        ReportColumn(
            "has_driving_license", "Has Driving License", "bool",
            Candidate.has_driving_license,
        ),
        ReportColumn(
            "willing_to_relocate", "Willing to Relocate", "bool",
            Candidate.willing_to_relocate,
        ),
        ReportColumn("source", "Source", "enum", Candidate.source),
        ReportColumn("status", "Status", "enum", Candidate.status),
        ReportColumn("created_at", "Created At", "datetime", Candidate.created_at),
        ReportColumn(
            "institution.name", "Institution Name", "string",
            CandInstitution.name,
        ),
        ReportColumn(
            "registered_by.full_name", "Registered By", "string",
            CandRegisteredBy.full_name,
        ),
    ],
)


JOBS = DataSource(
    key="jobs",
    label="Job Postings",
    model=JobPosting,
    description="Job opening records.",
    joins={
        "employer": Join(JobEmployer, JobPosting.employer_id == JobEmployer.id),
        "creator": Join(JobCreator, JobPosting.created_by_id == JobCreator.id),
        "recruiter": Join(
            JobRecruiter, JobPosting.assigned_recruiter_id == JobRecruiter.id
        ),
    },
    columns=[
        ReportColumn("id", "ID", "number", JobPosting.id, aggregate_ok=True),
        ReportColumn("title", "Title", "string", JobPosting.title),
        ReportColumn("category", "Category", "string", JobPosting.category),
        ReportColumn("industry", "Industry", "string", JobPosting.industry),
        ReportColumn("employment_type", "Employment Type", "string", JobPosting.employment_type),
        ReportColumn("shift_type", "Shift", "string", JobPosting.shift_type),
        ReportColumn("vacancies", "Vacancies", "number", JobPosting.vacancies, aggregate_ok=True),
        ReportColumn("salary_min", "Salary Min", "number", JobPosting.salary_min, aggregate_ok=True),
        ReportColumn("salary_max", "Salary Max", "number", JobPosting.salary_max, aggregate_ok=True),
        ReportColumn("work_city", "Work City", "string", JobPosting.work_city),
        ReportColumn("work_state", "Work State", "string", JobPosting.work_state),
        ReportColumn(
            "min_experience_years", "Min Experience (yrs)", "number",
            JobPosting.min_experience_years, aggregate_ok=True,
        ),
        ReportColumn("status", "Status", "enum", JobPosting.status),
        ReportColumn("hiring_priority", "Priority", "string", JobPosting.hiring_priority),
        ReportColumn("published_at", "Published At", "datetime", JobPosting.published_at),
        ReportColumn("created_at", "Created At", "datetime", JobPosting.created_at),
        ReportColumn(
            "employer.company_name", "Client Company", "string",
            JobEmployer.company_name,
        ),
        ReportColumn(
            "employer.industry", "Client Industry", "string", JobEmployer.industry
        ),
        ReportColumn("creator.full_name", "Created By", "string", JobCreator.full_name),
        ReportColumn(
            "recruiter.full_name", "Assigned Recruiter", "string", JobRecruiter.full_name
        ),
    ],
)


APPLICATIONS = DataSource(
    key="applications",
    label="Applications",
    model=Application,
    description="Candidate ↔ job pipeline records.",
    joins={
        "candidate": Join(AppCandidate, Application.candidate_id == AppCandidate.id),
        "job": Join(AppJob, Application.job_id == AppJob.id),
        "recruiter": Join(AppRecruiter, Application.assigned_recruiter_id == AppRecruiter.id),
    },
    columns=[
        ReportColumn("id", "ID", "number", Application.id, aggregate_ok=True),
        ReportColumn("status", "Status", "enum", Application.status),
        ReportColumn("current_stage_type", "Current Stage", "enum", Application.current_stage_type),
        ReportColumn("created_at", "Created At", "datetime", Application.created_at),
        ReportColumn("candidate.full_name", "Candidate", "string", AppCandidate.full_name),
        ReportColumn("candidate.city", "Candidate City", "string", AppCandidate.city),
        ReportColumn(
            "candidate.primary_trade", "Candidate Trade", "string",
            AppCandidate.primary_trade,
        ),
        ReportColumn("candidate.phone", "Candidate Phone", "string", AppCandidate.phone, is_pii=True),
        ReportColumn("job.title", "Job Title", "string", AppJob.title),
        ReportColumn("job.category", "Job Category", "string", AppJob.category),
        ReportColumn("job.work_city", "Job City", "string", AppJob.work_city),
        ReportColumn("recruiter.full_name", "Recruiter", "string", AppRecruiter.full_name),
    ],
)


STAGE_EVALUATIONS = DataSource(
    key="stage_evaluations",
    label="Stage Evaluations",
    model=StageEvaluation,
    description="Individual stage outcomes across the interview pipeline.",
    joins={
        "application": Join(EvalApp, StageEvaluation.application_id == EvalApp.id),
        "evaluator": Join(EvalUser, StageEvaluation.evaluated_by_id == EvalUser.id),
    },
    columns=[
        ReportColumn("id", "ID", "number", StageEvaluation.id, aggregate_ok=True),
        ReportColumn("stage_type", "Stage", "enum", StageEvaluation.stage_type),
        ReportColumn("outcome", "Outcome", "enum", StageEvaluation.outcome),
        ReportColumn("score", "Score", "number", StageEvaluation.score, aggregate_ok=True),
        ReportColumn("evaluated_at", "Evaluated At", "datetime", StageEvaluation.evaluated_at),
        ReportColumn("created_at", "Created At", "datetime", StageEvaluation.created_at),
        ReportColumn(
            "application.status", "Application Status", "enum", EvalApp.status
        ),
        ReportColumn("evaluator.full_name", "Evaluator", "string", EvalUser.full_name),
    ],
)


EMPLOYERS = DataSource(
    key="employers",
    label="Employers (Clients)",
    model=Employer,
    description="Client companies where candidates are placed.",
    columns=[
        ReportColumn("id", "ID", "number", Employer.id, aggregate_ok=True),
        ReportColumn("company_name", "Company Name", "string", Employer.company_name),
        ReportColumn("industry", "Industry", "string", Employer.industry),
        ReportColumn("company_type", "Company Type", "string", Employer.company_type),
        ReportColumn("city", "City", "string", Employer.city),
        ReportColumn("state", "State", "string", Employer.state),
        ReportColumn("is_active", "Active", "bool", Employer.is_active),
        ReportColumn("created_at", "Created At", "datetime", Employer.created_at),
        ReportColumn("contact_person", "Contact Person", "string", Employer.contact_person),
        ReportColumn("email", "Email", "string", Employer.email, is_pii=True),
        ReportColumn("phone", "Phone", "string", Employer.phone, is_pii=True),
    ],
)


INSTITUTIONS = DataSource(
    key="institutions",
    label="Institutions",
    model=Institution,
    description="Training institutes / ITIs supplying candidates.",
    columns=[
        ReportColumn("id", "ID", "number", Institution.id, aggregate_ok=True),
        ReportColumn("name", "Name", "string", Institution.name),
        ReportColumn("city", "City", "string", Institution.city),
        ReportColumn("state", "State", "string", Institution.state),
        ReportColumn("is_active", "Active", "bool", Institution.is_active),
        ReportColumn("created_at", "Created At", "datetime", Institution.created_at),
        ReportColumn("contact_person", "Contact Person", "string", Institution.contact_person),
        ReportColumn("email", "Email", "string", Institution.email, is_pii=True),
        ReportColumn("phone", "Phone", "string", Institution.phone, is_pii=True),
    ],
)


USERS = DataSource(
    key="users",
    label="Users",
    model=User,
    description="Portal users across all roles.",
    joins={"role": Join(UserRole, User.role_id == UserRole.id, isouter=False)},
    columns=[
        ReportColumn("id", "ID", "number", User.id, aggregate_ok=True),
        ReportColumn("full_name", "Full Name", "string", User.full_name),
        ReportColumn("email", "Email", "string", User.email),
        ReportColumn("phone", "Phone", "string", User.phone, is_pii=True),
        ReportColumn("is_active", "Active", "bool", User.is_active),
        ReportColumn("role.name", "Role", "string", UserRole.name),
        ReportColumn("created_at", "Created At", "datetime", User.created_at),
    ],
)


LEADS = DataSource(
    key="leads",
    label="Inbound Leads",
    model=LeadInbound,
    description="Raw leads before candidate promotion.",
    joins={
        "candidate": Join(LeadCandidate, LeadInbound.candidate_id == LeadCandidate.id),
    },
    columns=[
        ReportColumn("id", "ID", "number", LeadInbound.id, aggregate_ok=True),
        ReportColumn("source", "Source", "string", LeadInbound.source),
        ReportColumn("full_name", "Full Name", "string", LeadInbound.full_name),
        ReportColumn("phone", "Phone", "string", LeadInbound.phone, is_pii=True),
        ReportColumn("email", "Email", "string", LeadInbound.email, is_pii=True),
        ReportColumn("trade", "Trade", "string", LeadInbound.trade),
        ReportColumn("city", "City", "string", LeadInbound.city),
        ReportColumn("state", "State", "string", LeadInbound.state),
        ReportColumn("status", "Status", "enum", LeadInbound.status),
        ReportColumn("created_at", "Created At", "datetime", LeadInbound.created_at),
        ReportColumn(
            "candidate.full_name", "Promoted To Candidate", "string", LeadCandidate.full_name
        ),
    ],
)


AGENT_LOCATION_LOGS = DataSource(
    key="agent_location_logs",
    label="Agent GPS Log",
    model=AgentLocationLog,
    description="Field-agent GPS check-ins over time.",
    joins={"agent": Join(LocUser, AgentLocationLog.field_agent_id == LocUser.id)},
    columns=[
        ReportColumn("id", "ID", "number", AgentLocationLog.id, aggregate_ok=True),
        ReportColumn("event_type", "Event", "string", AgentLocationLog.event_type),
        ReportColumn(
            "latitude", "Latitude", "number", AgentLocationLog.latitude, group_by_ok=False
        ),
        ReportColumn(
            "longitude", "Longitude", "number", AgentLocationLog.longitude, group_by_ok=False
        ),
        ReportColumn("location_name", "Location Name", "string", AgentLocationLog.location_name),
        ReportColumn("city", "City", "string", AgentLocationLog.city),
        ReportColumn("created_at", "Logged At", "datetime", AgentLocationLog.created_at),
        ReportColumn("agent.full_name", "Field Agent", "string", LocUser.full_name),
    ],
)


AUDIT_LOGS = DataSource(
    key="audit_logs",
    label="Audit Log",
    model=AuditLog,
    description="System-wide action audit trail.",
    joins={"user": Join(AuditUser, AuditLog.user_id == AuditUser.id)},
    columns=[
        ReportColumn("id", "ID", "number", AuditLog.id, aggregate_ok=True),
        ReportColumn("action", "Action", "string", AuditLog.action),
        ReportColumn("entity_type", "Entity Type", "string", AuditLog.entity_type),
        ReportColumn("entity_id", "Entity ID", "number", AuditLog.entity_id),
        ReportColumn("ip_address", "IP", "string", AuditLog.ip_address, is_pii=True),
        ReportColumn("created_at", "When", "datetime", AuditLog.created_at),
        ReportColumn("user.full_name", "User", "string", AuditUser.full_name),
    ],
)


PII_ACCESS_LOGS = DataSource(
    key="pii_access_logs",
    label="PII Access Log",
    model=PiiAccessLog,
    description="Every time a user unmasks candidate PII.",
    joins={
        "user": Join(PiiUser, PiiAccessLog.user_id == PiiUser.id),
        "candidate": Join(PiiCandidate, PiiAccessLog.candidate_id == PiiCandidate.id),
    },
    columns=[
        ReportColumn("id", "ID", "number", PiiAccessLog.id, aggregate_ok=True),
        ReportColumn("fields_revealed", "Fields Revealed", "string", PiiAccessLog.fields_revealed),
        ReportColumn("ip_address", "IP", "string", PiiAccessLog.ip_address, is_pii=True),
        ReportColumn("created_at", "When", "datetime", PiiAccessLog.created_at),
        ReportColumn("user.full_name", "User", "string", PiiUser.full_name),
        ReportColumn("candidate.full_name", "Candidate", "string", PiiCandidate.full_name),
    ],
)


KYC_DOCUMENTS = DataSource(
    key="kyc_documents",
    label="KYC Documents",
    model=KycDocument,
    description="Uploaded KYC documents and verification state.",
    joins={
        "candidate": Join(KycCandidate, KycDocument.candidate_id == KycCandidate.id),
        "verifier": Join(KycVerifier, KycDocument.verified_by_id == KycVerifier.id),
    },
    columns=[
        ReportColumn("id", "ID", "number", KycDocument.id, aggregate_ok=True),
        ReportColumn("document_type", "Document Type", "string", KycDocument.document_type),
        ReportColumn("status", "Status", "enum", KycDocument.status),
        ReportColumn("verified_at", "Verified At", "datetime", KycDocument.verified_at),
        ReportColumn("created_at", "Uploaded At", "datetime", KycDocument.created_at),
        ReportColumn("candidate.full_name", "Candidate", "string", KycCandidate.full_name),
        ReportColumn("verifier.full_name", "Verified By", "string", KycVerifier.full_name),
    ],
)


REGISTRY: dict[str, DataSource] = {
    ds.key: ds
    for ds in [
        CANDIDATES,
        JOBS,
        APPLICATIONS,
        STAGE_EVALUATIONS,
        EMPLOYERS,
        INSTITUTIONS,
        USERS,
        LEADS,
        AGENT_LOCATION_LOGS,
        AUDIT_LOGS,
        PII_ACCESS_LOGS,
        KYC_DOCUMENTS,
    ]
}


def get_datasource(key: str) -> Optional[DataSource]:
    return REGISTRY.get(key)


def all_datasources() -> list[DataSource]:
    return list(REGISTRY.values())
