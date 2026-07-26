"""Field-agent registration drives (camps) — CRUD + share-kit generation."""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.v1.admin import get_public_base_url
from app.core.deps import require_roles
from app.core.enums import DriveStatus, RoleName
from app.db.session import get_db
from app.integrations.qr import generate_qr_data_uri
from app.models.candidate import Candidate
from app.models.field_drive import FieldDrive
from app.models.user import User
from app.schemas.field_drive import (
    FieldDriveCreate,
    FieldDriveOut,
    FieldDriveShareKit,
    FieldDriveUpdate,
)

router = APIRouter(prefix="/field-drives", tags=["field-drives"])

_AGENT = require_roles(RoleName.FIELD_AGENT, RoleName.ADMIN, RoleName.MANAGER)
_OVERSIGHT = require_roles(RoleName.ADMIN, RoleName.MANAGER)


def _candidate_count(db: Session, drive_id: int) -> int:
    return (
        db.scalar(
            select(func.count()).select_from(Candidate).where(
                Candidate.field_drive_id == drive_id
            )
        )
        or 0
    )


def _to_out(db: Session, drive: FieldDrive, agent: Optional[User] = None) -> FieldDriveOut:
    if agent is None:
        agent = db.get(User, drive.field_agent_id)
    return FieldDriveOut(
        id=drive.id,
        field_agent_id=drive.field_agent_id,
        field_agent_name=agent.full_name if agent else None,
        title=drive.title,
        venue_name=drive.venue_name,
        setup_type=drive.setup_type,
        setup_type_other=drive.setup_type_other,
        address=drive.address,
        city=drive.city,
        state=drive.state,
        pincode=drive.pincode,
        latitude=drive.latitude,
        longitude=drive.longitude,
        status=drive.status,
        public_slug=drive.public_slug,
        start_date=drive.start_date,
        end_date=drive.end_date,
        notes=drive.notes,
        candidate_count=_candidate_count(db, drive.id),
        created_at=drive.created_at,
        updated_at=drive.updated_at,
    )


@router.get("", response_model=list[FieldDriveOut])
def list_drives(
    agent_id: int | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(_AGENT),
):
    stmt = select(FieldDrive).order_by(FieldDrive.created_at.desc())
    # Field agents only see their own drives; managers/admins can see all or filter.
    if current_user.role.name == RoleName.FIELD_AGENT.value:
        stmt = stmt.where(FieldDrive.field_agent_id == current_user.id)
    elif agent_id:
        stmt = stmt.where(FieldDrive.field_agent_id == agent_id)
    if status:
        stmt = stmt.where(FieldDrive.status == status)

    rows = db.scalars(stmt).all()
    agent_ids = {r.field_agent_id for r in rows}
    agents = {}
    if agent_ids:
        agents = {u.id: u for u in db.scalars(select(User).where(User.id.in_(agent_ids))).all()}
    return [_to_out(db, r, agents.get(r.field_agent_id)) for r in rows]


@router.post("", response_model=FieldDriveOut, status_code=201)
def create_drive(
    body: FieldDriveCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_AGENT),
):
    drive = FieldDrive(
        field_agent_id=current_user.id,
        title=body.title,
        venue_name=body.venue_name,
        setup_type=body.setup_type,
        setup_type_other=body.setup_type_other,
        address=body.address,
        city=body.city,
        state=body.state,
        pincode=body.pincode,
        latitude=body.latitude,
        longitude=body.longitude,
        start_date=body.start_date,
        end_date=body.end_date,
        notes=body.notes,
    )
    db.add(drive)
    db.commit()
    db.refresh(drive)
    return _to_out(db, drive, current_user)


@router.get("/{drive_id}", response_model=FieldDriveOut)
def get_drive(
    drive_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_AGENT),
):
    drive = _get_owned_drive(drive_id, db, current_user)
    return _to_out(db, drive)


def _get_owned_drive(drive_id: int, db: Session, current_user: User) -> FieldDrive:
    drive = db.get(FieldDrive, drive_id)
    if not drive:
        raise HTTPException(404, "Drive not found")
    if (
        current_user.role.name == RoleName.FIELD_AGENT.value
        and drive.field_agent_id != current_user.id
    ):
        raise HTTPException(403, "Not permitted")
    return drive


@router.put("/{drive_id}", response_model=FieldDriveOut)
def update_drive(
    drive_id: int,
    body: FieldDriveUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_AGENT),
):
    drive = _get_owned_drive(drive_id, db, current_user)
    payload = body.model_dump(exclude_unset=True)
    if payload.get("status") == DriveStatus.CLOSED.value and drive.status != DriveStatus.CLOSED.value:
        drive.closed_at = datetime.now(timezone.utc)
    for k, v in payload.items():
        setattr(drive, k, v)
    db.commit()
    db.refresh(drive)
    return _to_out(db, drive)


@router.post("/{drive_id}/close", response_model=FieldDriveOut)
def close_drive(
    drive_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_AGENT),
):
    drive = _get_owned_drive(drive_id, db, current_user)
    drive.status = DriveStatus.CLOSED.value
    drive.closed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(drive)
    return _to_out(db, drive)


@router.post("/{drive_id}/generate-link", response_model=FieldDriveShareKit)
def generate_link(
    drive_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_AGENT),
):
    """Generate (or return existing) public slug + QR + WhatsApp share link."""
    drive = _get_owned_drive(drive_id, db, current_user)
    if not drive.public_slug:
        drive.public_slug = secrets.token_urlsafe(8)
        db.commit()
        db.refresh(drive)

    base = get_public_base_url(db)
    registration_url = f"{base}/register/{drive.public_slug}"
    message = (
        f"Register for job opportunities at {drive.venue_name}! "
        f"Fill your details here: {registration_url}"
    )
    whatsapp_url = f"https://wa.me/?text={quote(message)}"

    return FieldDriveShareKit(
        id=drive.id,
        public_slug=drive.public_slug,
        registration_url=registration_url,
        qr_data_uri=generate_qr_data_uri(registration_url),
        whatsapp_share_url=whatsapp_url,
    )


@router.delete("/{drive_id}", status_code=204)
def delete_drive(
    drive_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_AGENT),
):
    drive = _get_owned_drive(drive_id, db, current_user)
    db.delete(drive)
    db.commit()
