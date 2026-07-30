from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.core.enums import CandidateSource, CandidateStatus, RoleName
from app.db.session import get_db
from app.integrations.excel import (
    INSTITUTION_TEMPLATE_COLUMNS,
    parse_candidate_workbook,
    parse_institution_csv,
)
from app.models.candidate import Candidate
from app.models.org import Institution, InstitutionUploadLog
from app.models.user import User
from app.schemas.candidate import CandidateOut
from app.schemas.org import (
    InstitutionCreate,
    InstitutionOut,
    InstitutionUploadLogOut,
    InstitutionUploadSummary,
)
from app.services.pii import mask_email, mask_phone

router = APIRouter(prefix="/institutions", tags=["institutions"])

_ADMIN_MGR = require_roles(RoleName.ADMIN, RoleName.MANAGER)
_UPLOADERS = require_roles(RoleName.ADMIN, RoleName.MANAGER, RoleName.INSTITUTION)


def _normalise_phone(phone: str) -> str:
    return "".join(ch for ch in str(phone) if ch.isdigit())


_BOOL_TRUE = {"yes", "true", "1", "y"}


def _bool_value(value: Any) -> bool | None:
    text = str(value).strip().lower()
    if text in _BOOL_TRUE:
        return True
    if text in {"no", "false", "0", "n"}:
        return False
    return None


def _get_current_institution(db: Session, current_user: User) -> Institution:
    if not current_user.institution_id:
        raise HTTPException(status_code=400, detail="User is not linked to an institution")
    inst = db.get(Institution, current_user.institution_id)
    if not inst:
        raise HTTPException(status_code=404, detail="Institution not found")
    return inst


@router.get("", response_model=list[InstitutionOut])
def list_institutions(db: Session = Depends(get_db), _: User = Depends(_UPLOADERS)):
    return db.scalars(select(Institution).order_by(Institution.name)).all()


@router.post("", response_model=InstitutionOut, status_code=201)
def create_institution(
    body: InstitutionCreate, db: Session = Depends(get_db), _: User = Depends(_ADMIN_MGR)
):
    inst = Institution(**body.model_dump())
    db.add(inst)
    db.commit()
    db.refresh(inst)
    return inst


@router.post("/me/upload-candidates", response_model=InstitutionUploadSummary)
async def upload_candidates_me(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(_UPLOADERS),
):
    """Placement-officer upload: creates candidates for the user's institution and logs the attempt."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    inst = _get_current_institution(db, current_user)
    name_lower = file.filename.lower()

    if name_lower.endswith((".xlsx", ".xlsm")):
        file_type = "xlsx"
        content = await file.read()
        rows, errors = parse_candidate_workbook(content)
    elif name_lower.endswith(".csv"):
        file_type = "csv"
        content = await file.read()
        rows, errors = parse_institution_csv(content)
    else:
        raise HTTPException(status_code=400, detail="Please upload an .xlsx or .csv file")

    valid_rows: list[dict] = []
    for record in rows:
        phone = _normalise_phone(record.get("phone", ""))
        if not record.get("full_name") or not phone or not record.get("primary_trade"):
            errors.append("Row missing required Student Name / Mobile Number / Trade - skipped.")
            continue
        record["phone"] = phone

        profile_data: dict[str, Any] = {}
        for extra_field in (
            "passing_year",
            "current_status",
            "preferred_job_role",
            "experience_level",
            "remarks",
        ):
            if extra_field in record:
                profile_data[extra_field] = record.pop(extra_field)
        if "date_of_birth" in record and record["date_of_birth"]:
            profile_data["date_of_birth_or_age"] = record.pop("date_of_birth")

        if "willing_to_relocate" in record:
            parsed = _bool_value(record.pop("willing_to_relocate"))
            if parsed is not None:
                record["willing_to_relocate"] = parsed

        if profile_data:
            record["profile_data"] = profile_data
        valid_rows.append(record)

    created = 0
    try:
        for record in valid_rows:
            db.add(
                Candidate(
                    **{k: v for k, v in record.items() if k != "responses"},
                    source=CandidateSource.INSTITUTION_UPLOAD,
                    institution_id=inst.id,
                    registered_by_id=current_user.id,
                )
            )
            created += 1

        status_value = (
            "failed"
            if created == 0 and valid_rows
            else ("partial" if errors else "success")
        )
        log = InstitutionUploadLog(
            institution_id=inst.id,
            registered_by_id=current_user.id,
            filename=file.filename,
            file_type=file_type,
            total_rows=len(valid_rows) + len(errors),
            created_count=created,
            skipped_count=len(valid_rows) + len(errors) - created,
            status=status_value,
            errors={"row_errors": errors[:100]},
        )
        db.add(log)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"created": created, "skipped": len(errors), "errors": errors}


@router.post("/{institution_id}/upload-candidates")
async def upload_candidates(
    institution_id: int,
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: User = Depends(_UPLOADERS),
):
    inst = db.get(Institution, institution_id)
    if not inst:
        raise HTTPException(status_code=404, detail="Institution not found")
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=400, detail="Please upload an .xlsx file")

    content = await file.read()
    rows, errors = parse_candidate_workbook(content)

    created = 0
    for record in rows:
        db.add(
            Candidate(
                **record,
                source=CandidateSource.INSTITUTION_UPLOAD,
                institution_id=institution_id,
                registered_by_id=current_user.id,
            )
        )
        created += 1
    db.commit()

    return {"created": created, "skipped": len(errors), "errors": errors}


@router.get("/me/upload-logs", response_model=list[InstitutionUploadLogOut])
def list_upload_logs(
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(_UPLOADERS),
):
    inst = _get_current_institution(db, current_user)
    stmt = (
        select(InstitutionUploadLog)
        .where(InstitutionUploadLog.institution_id == inst.id)
        .order_by(InstitutionUploadLog.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return db.scalars(stmt).all()


@router.get("/me/candidates", response_model=list[CandidateOut])
def list_my_candidates(
    q: str | None = None,
    status: CandidateStatus | None = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(_UPLOADERS),
):
    inst = _get_current_institution(db, current_user)
    stmt = select(Candidate).where(
        Candidate.institution_id == inst.id,
        Candidate.source == CandidateSource.INSTITUTION_UPLOAD,
    )
    if q:
        stmt = stmt.where(Candidate.full_name.ilike(f"%{q}%"))
    if status:
        stmt = stmt.where(Candidate.status == status)
    stmt = stmt.order_by(Candidate.created_at.desc()).limit(limit).offset(offset)
    rows = db.scalars(stmt).all()
    out: list[CandidateOut] = []
    for c in rows:
        serialized = CandidateOut.model_validate(c)
        serialized.phone = mask_phone(c.phone)
        serialized.email = mask_email(c.email)
        serialized.pii_masked = True
        out.append(serialized)
    return out
