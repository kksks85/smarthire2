from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.core.enums import RoleName
from app.db.session import get_db
from app.models.audit import AgentLocationLog
from app.models.user import User
from app.schemas.dashboard import LocationLogCreate, LocationLogOut

router = APIRouter(prefix="/field-agents", tags=["field-agents"])

_AGENT = require_roles(RoleName.FIELD_AGENT, RoleName.ADMIN, RoleName.MANAGER)
_OVERSIGHT = require_roles(RoleName.ADMIN, RoleName.MANAGER)


def _employee_id(user_id: int) -> str:
    return f"EMP-{user_id:04d}"


def _to_out(log: AgentLocationLog, agent: User | None) -> LocationLogOut:
    return LocationLogOut(
        id=log.id,
        field_agent_id=log.field_agent_id,
        field_agent_name=agent.full_name if agent else None,
        employee_id=_employee_id(log.field_agent_id),
        candidate_id=log.candidate_id,
        event_type=log.event_type,
        latitude=log.latitude,
        longitude=log.longitude,
        accuracy_m=log.accuracy_m,
        address_text=log.address_text,
        location_name=log.location_name,
        city=log.city,
        created_at=log.created_at,
    )


@router.post("/location", response_model=LocationLogOut, status_code=201)
def log_location(
    body: LocationLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_AGENT),
):
    """Field agent logs a GPS position (registration / check-in / visit / auto-track)."""
    log = AgentLocationLog(
        field_agent_id=current_user.id,
        candidate_id=body.candidate_id,
        event_type=body.event_type,
        latitude=body.latitude,
        longitude=body.longitude,
        accuracy_m=body.accuracy_m,
        address_text=body.address_text,
        location_name=body.location_name,
        city=body.city,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return _to_out(log, current_user)


@router.get("/location", response_model=list[LocationLogOut])
def list_locations(
    agent_id: int | None = None,
    limit: int = 500,
    db: Session = Depends(get_db),
    current_user: User = Depends(_AGENT),
):
    stmt = select(AgentLocationLog).order_by(AgentLocationLog.created_at.desc())
    # Field agents only see their own logs; managers/admins can filter by agent.
    if current_user.role.name == RoleName.FIELD_AGENT.value:
        stmt = stmt.where(AgentLocationLog.field_agent_id == current_user.id)
    elif agent_id:
        stmt = stmt.where(AgentLocationLog.field_agent_id == agent_id)

    logs = db.scalars(stmt.limit(limit)).all()

    # Batch-load the agent user records to enrich the response.
    agent_ids = {log.field_agent_id for log in logs}
    agents: dict[int, User] = {}
    if agent_ids:
        rows = db.scalars(select(User).where(User.id.in_(agent_ids))).all()
        agents = {u.id: u for u in rows}

    return [_to_out(log, agents.get(log.field_agent_id)) for log in logs]
