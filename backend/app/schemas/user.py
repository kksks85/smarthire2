from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict, EmailStr

from app.core.enums import RoleName


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    recruiter_details: Optional[Dict[str, Any]] = None


class UserCreate(UserBase):
    password: str
    role: RoleName
    institution_id: Optional[int] = None
    employer_id: Optional[int] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    role: Optional[RoleName] = None
    recruiter_details: Optional[Dict[str, Any]] = None


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    role: RoleName
    institution_id: Optional[int] = None
    employer_id: Optional[int] = None

    @classmethod
    def from_user(cls, user) -> "UserOut":
        return cls(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            phone=user.phone,
            is_active=user.is_active,
            role=RoleName(user.role.name),
            institution_id=user.institution_id,
            employer_id=user.employer_id,
            recruiter_details=user.recruiter_details,
        )

