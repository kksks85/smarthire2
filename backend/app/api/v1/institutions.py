from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.core.enums import CandidateSource, RoleName
from app.db.session import get_db
from app.integrations.excel import parse_candidate_workbook
from app.models.candidate import Candidate
from app.models.org import Institution
from app.models.user import User
from app.schemas.org import InstitutionCreate, InstitutionOut

router = APIRouter(prefix="/institutions", tags=["institutions"])

_ADMIN_MGR = require_roles(RoleName.ADMIN, RoleName.MANAGER)
_UPLOADERS = require_roles(RoleName.ADMIN, RoleName.MANAGER, RoleName.INSTITUTION)


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
