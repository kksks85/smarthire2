from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.core.enums import RoleName
from app.db.session import get_db
from app.models.org import Employer
from app.models.user import User
from app.schemas.org import EmployerCreate, EmployerOut

router = APIRouter(prefix="/employers", tags=["employers"])

_ADMIN_MGR = require_roles(RoleName.ADMIN, RoleName.MANAGER)
_VIEWERS = require_roles(
    RoleName.ADMIN, RoleName.MANAGER, RoleName.RECRUITER, RoleName.EMPLOYER
)


@router.get("", response_model=list[EmployerOut])
def list_employers(db: Session = Depends(get_db), _: User = Depends(_VIEWERS)):
    return db.scalars(select(Employer).order_by(Employer.company_name)).all()


@router.get("/{employer_id}", response_model=EmployerOut)
def get_employer(employer_id: int, db: Session = Depends(get_db), _: User = Depends(_VIEWERS)):
    employer = db.get(Employer, employer_id)
    if not employer:
        raise HTTPException(status_code=404, detail="Employer not found")
    return employer


@router.post("", response_model=EmployerOut, status_code=201)
def create_employer(
    body: EmployerCreate, db: Session = Depends(get_db), _: User = Depends(_ADMIN_MGR)
):
    emp = Employer(**body.model_dump())
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp


@router.put("/{employer_id}", response_model=EmployerOut)
def update_employer(
    employer_id: int,
    body: EmployerCreate,
    db: Session = Depends(get_db),
    _: User = Depends(_ADMIN_MGR)
):
    employer = db.get(Employer, employer_id)
    if not employer:
        raise HTTPException(status_code=404, detail="Employer not found")
    
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(employer, key, value)
    
    db.commit()
    db.refresh(employer)
    return employer
