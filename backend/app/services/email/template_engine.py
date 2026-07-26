"""Jinja2 template rendering with per-context merge-field catalogs.

Exposes:
  * ``MERGE_CATALOG`` — static registry consumed by both the backend
    ``/email/templates/merge-fields`` endpoint and the frontend picker.
  * :func:`render_template` — renders subject/body strings against a
    concrete entity from the database.
  * :func:`sample_context` — returns fabricated data for previewing a
    template before real entities exist.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from jinja2.sandbox import SandboxedEnvironment
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.candidate import Candidate
from app.models.job import JobPosting
from app.models.org import Employer
from app.models.pipeline import Application
from app.models.user import User

_env = SandboxedEnvironment(
    autoescape=False,  # subject + text are plain; body_html is trusted admin content
    trim_blocks=True,
    lstrip_blocks=True,
)


# ---------------------------------------------------------------------------
# Merge-field catalog
# ---------------------------------------------------------------------------

MERGE_CATALOG: dict[str, dict[str, Any]] = {
    "candidate": {
        "label": "Candidate",
        "fields": [
            ("full_name", "Full Name"),
            ("phone", "Phone"),
            ("email", "Email"),
            ("city", "City"),
            ("state", "State"),
            ("primary_trade", "Primary Trade"),
            ("experience_years", "Experience (yrs)"),
            ("expected_salary", "Expected Salary"),
            ("status", "Status"),
        ],
    },
    "job": {
        "label": "Job Posting",
        "fields": [
            ("title", "Job Title"),
            ("category", "Category"),
            ("employer_name", "Client Name"),
            ("work_city", "Work City"),
            ("work_state", "Work State"),
            ("salary_min", "Salary Min"),
            ("salary_max", "Salary Max"),
            ("vacancies", "Vacancies"),
            ("public_url", "Public Application URL"),
        ],
    },
    "employer": {
        "label": "Employer / Client",
        "fields": [
            ("company_name", "Company Name"),
            ("industry", "Industry"),
            ("contact_person", "Contact Person"),
            ("phone", "Phone"),
            ("email", "Email"),
            ("city", "City"),
        ],
    },
    "application": {
        "label": "Application",
        "fields": [
            ("status", "Status"),
            ("current_stage_type", "Current Stage"),
            ("candidate.full_name", "Candidate Name"),
            ("candidate.phone", "Candidate Phone"),
            ("job.title", "Job Title"),
            ("job.employer_name", "Client Name"),
        ],
    },
    "user": {
        "label": "User",
        "fields": [
            ("full_name", "Full Name"),
            ("email", "Email"),
            ("phone", "Phone"),
            ("role", "Role"),
        ],
    },
    "system": {
        "label": "System (always available)",
        "fields": [
            ("system.portal_url", "Portal URL"),
            ("system.now", "Current Timestamp"),
            ("system.date_today", "Today's Date"),
        ],
    },
}


# ---------------------------------------------------------------------------
# Context builders
# ---------------------------------------------------------------------------

def _system_context() -> dict[str, Any]:
    now = datetime.utcnow()
    return {
        "portal_url": settings.PUBLIC_BASE_URL,
        "now": now.isoformat(timespec="seconds"),
        "date_today": now.date().isoformat(),
    }


def _candidate_to_dict(c: Candidate) -> dict[str, Any]:
    return {
        "full_name": c.full_name,
        "phone": c.phone,
        "email": c.email,
        "city": c.city,
        "state": c.state,
        "primary_trade": c.primary_trade,
        "experience_years": c.experience_years,
        "expected_salary": c.expected_salary,
        "status": (c.status.value if hasattr(c.status, "value") else c.status),
    }


def _job_to_dict(j: JobPosting, employer_name: Optional[str] = None) -> dict[str, Any]:
    return {
        "title": j.title,
        "category": j.category,
        "employer_name": employer_name or "",
        "work_city": j.work_city,
        "work_state": j.work_state,
        "salary_min": j.salary_min,
        "salary_max": j.salary_max,
        "vacancies": j.vacancies,
        "public_url": f"{settings.PUBLIC_BASE_URL}/apply/{j.public_slug}" if j.public_slug else "",
    }


def _employer_to_dict(e: Employer) -> dict[str, Any]:
    return {
        "company_name": e.company_name,
        "industry": e.industry,
        "contact_person": e.contact_person,
        "phone": e.phone,
        "email": e.email,
        "city": e.city,
    }


def _user_to_dict(u: User) -> dict[str, Any]:
    role_name = ""
    try:
        role_name = u.role.name.value if hasattr(u.role.name, "value") else str(u.role.name)
    except Exception:
        role_name = ""
    return {
        "full_name": u.full_name,
        "email": u.email,
        "phone": u.phone,
        "role": role_name,
    }


def build_context(
    db: Session,
    merge_context: str,
    entity_id: Optional[int],
) -> dict[str, Any]:
    """Load an entity from the DB and return the Jinja render context.

    Falls back to sample data if the entity is not found or entity_id is None.
    """
    ctx: dict[str, Any] = {"system": _system_context()}

    if merge_context == "candidate" and entity_id:
        c = db.get(Candidate, entity_id)
        ctx["candidate"] = _candidate_to_dict(c) if c else sample_context("candidate")["candidate"]
    elif merge_context == "job" and entity_id:
        j = db.get(JobPosting, entity_id)
        if j:
            employer = db.get(Employer, j.employer_id) if j.employer_id else None
            ctx["job"] = _job_to_dict(j, employer.company_name if employer else None)
        else:
            ctx["job"] = sample_context("job")["job"]
    elif merge_context == "employer" and entity_id:
        e = db.get(Employer, entity_id)
        ctx["employer"] = _employer_to_dict(e) if e else sample_context("employer")["employer"]
    elif merge_context == "application" and entity_id:
        a = db.get(Application, entity_id)
        if a:
            c = db.get(Candidate, a.candidate_id) if a.candidate_id else None
            j = db.get(JobPosting, a.job_id) if a.job_id else None
            employer = db.get(Employer, j.employer_id) if j and j.employer_id else None
            ctx["application"] = {
                "status": (a.status.value if hasattr(a.status, "value") else a.status),
                "current_stage_type": (
                    a.current_stage_type.value
                    if hasattr(a.current_stage_type, "value")
                    else a.current_stage_type
                ),
                "candidate": _candidate_to_dict(c) if c else {},
                "job": _job_to_dict(j, employer.company_name if employer else None) if j else {},
            }
        else:
            ctx["application"] = sample_context("application")["application"]
    elif merge_context == "user" and entity_id:
        u = db.get(User, entity_id)
        ctx["user"] = _user_to_dict(u) if u else sample_context("user")["user"]
    else:
        # Merge context is 'none' or entity_id missing — populate sample data
        # so template variables at least resolve to something.
        if merge_context != "none":
            ctx.update(sample_context(merge_context))

    return ctx


def sample_context(merge_context: str) -> dict[str, Any]:
    """Fabricated data for template previewing."""
    system = _system_context()
    if merge_context == "candidate":
        return {
            "system": system,
            "candidate": {
                "full_name": "Ravi Kumar",
                "phone": "+91 98765 43210",
                "email": "ravi.kumar@example.com",
                "city": "Pune",
                "state": "Maharashtra",
                "primary_trade": "Electrician",
                "experience_years": 5,
                "expected_salary": 22000,
                "status": "new",
            },
        }
    if merge_context == "job":
        return {
            "system": system,
            "job": {
                "title": "Senior Electrician",
                "category": "Electrical",
                "employer_name": "Acme Manufacturing Ltd.",
                "work_city": "Pune",
                "work_state": "Maharashtra",
                "salary_min": 20000,
                "salary_max": 30000,
                "vacancies": 3,
                "public_url": f"{settings.PUBLIC_BASE_URL}/apply/sample-job",
            },
        }
    if merge_context == "employer":
        return {
            "system": system,
            "employer": {
                "company_name": "Acme Manufacturing Ltd.",
                "industry": "Manufacturing",
                "contact_person": "Anita Rao",
                "phone": "+91 98765 00000",
                "email": "hr@acme.example.com",
                "city": "Pune",
            },
        }
    if merge_context == "application":
        return {
            "system": system,
            "application": {
                "status": "in_progress",
                "current_stage_type": "screening",
                "candidate": sample_context("candidate")["candidate"],
                "job": sample_context("job")["job"],
            },
        }
    if merge_context == "user":
        return {
            "system": system,
            "user": {
                "full_name": "Priya Sharma",
                "email": "priya@smarthire.io",
                "phone": "+91 90000 00000",
                "role": "recruiter",
            },
        }
    return {"system": system}


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------

def render_string(template_str: Optional[str], context: dict[str, Any]) -> Optional[str]:
    """Render a single template string. Returns None if input is None."""
    if template_str is None:
        return None
    try:
        tmpl = _env.from_string(template_str)
        return tmpl.render(**context)
    except Exception as exc:  # noqa: BLE001
        # Surface the raw error to help the admin fix their template.
        return f"[template error: {exc}]"


def render_template(
    db: Session,
    *,
    subject: str,
    body_html: Optional[str],
    body_text: Optional[str],
    merge_context: str,
    entity_id: Optional[int] = None,
    extra: Optional[dict[str, Any]] = None,
) -> tuple[str, Optional[str], Optional[str], dict[str, Any]]:
    """Render subject + body pair. Returns (subject, html, text, context_used)."""
    ctx = build_context(db, merge_context, entity_id)
    if extra:
        ctx.update(extra)
    return (
        render_string(subject, ctx) or "",
        render_string(body_html, ctx),
        render_string(body_text, ctx),
        ctx,
    )
