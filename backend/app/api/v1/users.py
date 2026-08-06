from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.core.enums import RoleName
from app.core.security import hash_password
from app.db.session import get_db
from app.models.user import Role, User
from app.schemas.user import UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])

# Admin manages all users; Manager may manage recruiters/field agents.
_ADMIN = require_roles(RoleName.ADMIN)
_ADMIN_OR_MANAGER = require_roles(RoleName.ADMIN, RoleName.MANAGER)


@router.get("", response_model=list[UserOut])
def list_users(
    role: RoleName | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(_ADMIN_OR_MANAGER),
):
    stmt = select(User)
    if role:
        stmt = stmt.join(Role).where(Role.name == role.value)
    return [UserOut.from_user(u) for u in db.scalars(stmt).all()]


@router.post("", response_model=UserOut, status_code=201)
def create_user(
    body: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(_ADMIN),
):
    if db.scalar(select(User).where(User.email == body.email)):
        raise HTTPException(status_code=409, detail="Email already registered")

    role = db.scalar(select(Role).where(Role.name == body.role.value))
    if not role:
        raise HTTPException(status_code=400, detail="Invalid role")

    user = User(
        email=body.email,
        full_name=body.full_name,
        phone=body.phone,
        hashed_password=hash_password(body.password),
        role_id=role.id,
        institution_id=body.institution_id,
        employer_id=body.employer_id,
        recruiter_details=body.recruiter_details,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserOut.from_user(user)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    body: UserUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(_ADMIN),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.full_name is not None:
        user.full_name = body.full_name
    if body.phone is not None:
        user.phone = body.phone
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.role is not None:
        role = db.scalar(select(Role).where(Role.name == body.role.value))
        if not role:
            raise HTTPException(status_code=400, detail="Invalid role")
        user.role_id = role.id
    if body.recruiter_details is not None:
        user.recruiter_details = body.recruiter_details

    db.commit()
    db.refresh(user)
    return UserOut.from_user(user)

