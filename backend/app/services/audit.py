from typing import Optional

from sqlalchemy.orm import Session

from app.models.audit import AuditLog, PiiAccessLog


def record_audit(
    db: Session,
    *,
    user_id: Optional[int],
    action: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    detail: Optional[str] = None,
    ip_address: Optional[str] = None,
    commit: bool = True,
) -> AuditLog:
    log = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        detail=detail,
        ip_address=ip_address,
    )
    db.add(log)
    if commit:
        db.commit()
    return log


def record_pii_access(
    db: Session,
    *,
    user_id: int,
    candidate_id: int,
    fields_revealed: list[str],
    ip_address: Optional[str] = None,
    commit: bool = True,
) -> PiiAccessLog:
    log = PiiAccessLog(
        user_id=user_id,
        candidate_id=candidate_id,
        fields_revealed=",".join(fields_revealed),
        ip_address=ip_address,
    )
    db.add(log)
    if commit:
        db.commit()
    return log
