from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import reference
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import Role, User

router = APIRouter(prefix="/reference", tags=["reference"])


@router.get("")
def get_reference_data():
    """Dropdown / master reference data for forms (India blue-collar)."""
    return {
        "states": reference.INDIAN_STATES,
        "job_categories": reference.BLUE_COLLAR_CATEGORIES,
        "certifications": reference.SKILL_CERTIFICATIONS,
        "kyc_document_types": reference.KYC_DOCUMENT_TYPES,
        "employment_types": reference.EMPLOYMENT_TYPES,
        "shift_types": reference.SHIFT_TYPES,
        "education_levels": reference.EDUCATION_LEVELS,
        "languages": reference.LANGUAGES,
    }


@router.get("/roles")
def list_roles(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Role master (id + name) — used by report sharing UI."""
    rows = db.scalars(select(Role).order_by(Role.name.asc())).all()
    return [
        {"id": r.id, "name": r.name.value if hasattr(r.name, "value") else str(r.name)}
        for r in rows
    ]
