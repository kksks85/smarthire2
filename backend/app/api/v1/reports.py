"""Reporting engine API endpoints."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.core.enums import RoleName
from app.db.session import get_db
from app.models.report import Report, ReportSchedule, ReportShare
from app.models.user import Role, User
from app.schemas.report import (
    ColumnMeta,
    DataSourceMeta,
    OperatorMeta,
    ReportCreate,
    ReportOut,
    ReportPreviewRequest,
    ReportRunResult,
    ReportScheduleCreate,
    ReportScheduleOut,
    ReportScheduleUpdate,
    ReportShareCreate,
    ReportShareOut,
    ReportUpdate,
)
from app.services.reports import export as export_svc
from app.services.reports import operators as ops_mod
from app.services.reports import query as query_svc
from app.services.reports.datasources import all_datasources, get_datasource

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["reports"])

_STAFF = require_roles(
    RoleName.ADMIN, RoleName.MANAGER, RoleName.RECRUITER, RoleName.FIELD_AGENT
)
_BUILDERS = require_roles(RoleName.ADMIN, RoleName.MANAGER, RoleName.RECRUITER)


# ---------------------------------------------------------------------------
# Data source metadata (drives the builder UI)
# ---------------------------------------------------------------------------

def _column_meta(col, user: User) -> Optional[ColumnMeta]:
    # Hide PII columns from users who cannot see them.
    role = user.role.name.value if hasattr(user.role.name, "value") else str(user.role.name)
    can_see_pii = role in (RoleName.ADMIN.value, RoleName.MANAGER.value)
    if col.is_pii and not can_see_pii:
        return None
    return ColumnMeta(
        name=col.name,
        label=col.label,
        type=col.type,
        filterable=col.filterable,
        group_by_ok=col.group_by_ok,
        aggregate_ok=col.aggregate_ok,
        is_pii=col.is_pii,
        operators=[
            OperatorMeta(key=o.key, label=o.label, unary=o.unary, multi=o.multi)
            for o in ops_mod.operators_for(col.type)
        ],
    )


@router.get("/data-sources", response_model=list[DataSourceMeta])
def list_data_sources(current_user: User = Depends(_STAFF)):
    result = []
    for ds in all_datasources():
        cols = [c for c in (_column_meta(col, current_user) for col in ds.columns) if c]
        result.append(
            DataSourceMeta(key=ds.key, label=ds.label, description=ds.description, columns=cols)
        )
    return result


# ---------------------------------------------------------------------------
# Report CRUD
# ---------------------------------------------------------------------------

def _visible_reports_stmt(current_user: User):
    """Reports owned OR shared with the user (individually or via role)."""
    role_id = current_user.role_id
    return (
        select(Report)
        .outerjoin(
            ReportShare,
            (ReportShare.report_id == Report.id),
        )
        .where(
            or_(
                Report.owner_id == current_user.id,
                Report.is_public.is_(True),
                (ReportShare.principal_type == "user")
                & (ReportShare.principal_id == current_user.id),
                (ReportShare.principal_type == "role")
                & (ReportShare.principal_id == role_id),
            )
        )
        .distinct()
        .order_by(Report.updated_at.desc())
    )


def _can_edit(report: Report, current_user: User, db: Session) -> bool:
    if report.owner_id == current_user.id:
        return True
    role_name = (
        current_user.role.name.value
        if hasattr(current_user.role.name, "value")
        else str(current_user.role.name)
    )
    if role_name == RoleName.ADMIN.value:
        return True
    # Shared with edit permission?
    grant = db.scalars(
        select(ReportShare).where(
            ReportShare.report_id == report.id,
            ReportShare.permission == "edit",
            or_(
                (ReportShare.principal_type == "user")
                & (ReportShare.principal_id == current_user.id),
                (ReportShare.principal_type == "role")
                & (ReportShare.principal_id == current_user.role_id),
            ),
        )
    ).first()
    return grant is not None


def _report_out(report: Report, current_user: User, db: Session) -> ReportOut:
    owner = db.get(User, report.owner_id)
    return ReportOut(
        id=report.id,
        name=report.name,
        description=report.description,
        data_source=report.data_source,
        filters=report.filters,
        columns=report.columns,
        group_by=report.group_by,
        order_by=report.order_by,
        display_type=report.display_type,
        display_options=report.display_options,
        row_limit=report.row_limit,
        is_public=report.is_public,
        owner_id=report.owner_id,
        owner_name=owner.full_name if owner else None,
        can_edit=_can_edit(report, current_user, db),
        created_at=report.created_at,
        updated_at=report.updated_at,
    )


@router.get("", response_model=list[ReportOut])
def list_reports(db: Session = Depends(get_db), current_user: User = Depends(_STAFF)):
    rows = db.scalars(_visible_reports_stmt(current_user)).all()
    return [_report_out(r, current_user, db) for r in rows]


@router.post("", response_model=ReportOut, status_code=201)
def create_report(
    body: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_BUILDERS),
):
    if not get_datasource(body.data_source):
        raise HTTPException(400, f"Unknown data source '{body.data_source}'.")
    report = Report(**body.model_dump(), owner_id=current_user.id)
    db.add(report)
    db.commit()
    db.refresh(report)
    return _report_out(report, current_user, db)


def _get_visible_report(report_id: int, db: Session, current_user: User) -> Report:
    report = db.scalars(
        _visible_reports_stmt(current_user).where(Report.id == report_id)
    ).first()
    if not report:
        raise HTTPException(404, "Report not found")
    return report


@router.get("/{report_id}", response_model=ReportOut)
def get_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_STAFF),
):
    return _report_out(_get_visible_report(report_id, db, current_user), current_user, db)


@router.put("/{report_id}", response_model=ReportOut)
def update_report(
    report_id: int,
    body: ReportUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_STAFF),
):
    report = _get_visible_report(report_id, db, current_user)
    if not _can_edit(report, current_user, db):
        raise HTTPException(403, "Not permitted to edit this report")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(report, k, v)
    db.commit()
    db.refresh(report)
    return _report_out(report, current_user, db)


@router.delete("/{report_id}", status_code=204)
def delete_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_STAFF),
):
    report = _get_visible_report(report_id, db, current_user)
    if not _can_edit(report, current_user, db):
        raise HTTPException(403, "Not permitted")
    db.delete(report)
    db.commit()


# ---------------------------------------------------------------------------
# Run / preview / export
# ---------------------------------------------------------------------------

@router.post("/{report_id}/run", response_model=ReportRunResult)
def run_saved(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_STAFF),
):
    report = _get_visible_report(report_id, db, current_user)
    try:
        result = query_svc.run_report(
            db,
            data_source=report.data_source,
            filters=report.filters,
            columns=report.columns,
            group_by=report.group_by,
            order_by=report.order_by,
            row_limit=report.row_limit,
            current_user=current_user,
        )
    except query_svc.ReportError as exc:
        raise HTTPException(400, str(exc))
    result["display_type"] = report.display_type
    result["display_options"] = report.display_options or {}
    return result


@router.post("/preview", response_model=ReportRunResult)
def run_preview(
    body: ReportPreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(_BUILDERS),
):
    try:
        result = query_svc.run_report(
            db,
            data_source=body.data_source,
            filters=body.filters,
            columns=body.columns,
            group_by=body.group_by,
            order_by=body.order_by,
            row_limit=body.row_limit,
            current_user=current_user,
        )
    except query_svc.ReportError as exc:
        raise HTTPException(400, str(exc))
    result["display_type"] = body.display_type
    result["display_options"] = body.display_options or {}
    return result


@router.get("/{report_id}/export")
def export_saved(
    report_id: int,
    fmt: str = "csv",
    db: Session = Depends(get_db),
    current_user: User = Depends(_STAFF),
):
    if fmt not in ("csv", "xlsx"):
        raise HTTPException(400, "fmt must be 'csv' or 'xlsx'")
    report = _get_visible_report(report_id, db, current_user)
    result = query_svc.run_report(
        db,
        data_source=report.data_source,
        filters=report.filters,
        columns=report.columns,
        group_by=report.group_by,
        order_by=report.order_by,
        row_limit=report.row_limit,
        current_user=current_user,
    )
    safe_name = "".join(ch if ch.isalnum() else "_" for ch in report.name)[:80] or "report"
    if fmt == "csv":
        data = export_svc.to_csv(result)
        return Response(
            content=data,
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_name}.csv"'
            },
        )
    data = export_svc.to_xlsx(result, sheet_name=safe_name)
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}.xlsx"'
        },
    )


# ---------------------------------------------------------------------------
# Sharing
# ---------------------------------------------------------------------------

def _principal_label(share: ReportShare, db: Session) -> Optional[str]:
    if share.principal_type == "user":
        u = db.get(User, share.principal_id)
        return u.full_name if u else None
    if share.principal_type == "role":
        r = db.get(Role, share.principal_id)
        if r:
            return r.name.value if hasattr(r.name, "value") else str(r.name)
    return None


@router.get("/{report_id}/shares", response_model=list[ReportShareOut])
def list_shares(
    report_id: int, db: Session = Depends(get_db), current_user: User = Depends(_STAFF)
):
    report = _get_visible_report(report_id, db, current_user)
    rows = db.scalars(
        select(ReportShare).where(ReportShare.report_id == report.id)
    ).all()
    return [
        ReportShareOut(
            id=s.id,
            report_id=s.report_id,
            principal_type=s.principal_type,
            principal_id=s.principal_id,
            principal_label=_principal_label(s, db),
            permission=s.permission,
            created_at=s.created_at,
        )
        for s in rows
    ]


@router.post("/{report_id}/shares", response_model=ReportShareOut, status_code=201)
def create_share(
    report_id: int,
    body: ReportShareCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_STAFF),
):
    report = _get_visible_report(report_id, db, current_user)
    if not _can_edit(report, current_user, db):
        raise HTTPException(403, "Not permitted")
    share = ReportShare(
        report_id=report.id,
        principal_type=body.principal_type,
        principal_id=body.principal_id,
        permission=body.permission,
    )
    db.add(share)
    db.commit()
    db.refresh(share)
    return ReportShareOut(
        id=share.id,
        report_id=share.report_id,
        principal_type=share.principal_type,
        principal_id=share.principal_id,
        principal_label=_principal_label(share, db),
        permission=share.permission,
        created_at=share.created_at,
    )


@router.delete("/{report_id}/shares/{share_id}", status_code=204)
def delete_share(
    report_id: int,
    share_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_STAFF),
):
    report = _get_visible_report(report_id, db, current_user)
    if not _can_edit(report, current_user, db):
        raise HTTPException(403, "Not permitted")
    share = db.get(ReportShare, share_id)
    if not share or share.report_id != report.id:
        raise HTTPException(404, "Share not found")
    db.delete(share)
    db.commit()


# ---------------------------------------------------------------------------
# Scheduling
# ---------------------------------------------------------------------------

def _compute_next_run(cron_expr: str, base: Optional[datetime] = None) -> datetime:
    from croniter import croniter  # local import

    base = base or datetime.utcnow()
    itr = croniter(cron_expr, base)
    return itr.get_next(datetime)


@router.get("/{report_id}/schedules", response_model=list[ReportScheduleOut])
def list_schedules(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_STAFF),
):
    report = _get_visible_report(report_id, db, current_user)
    rows = db.scalars(
        select(ReportSchedule)
        .where(ReportSchedule.report_id == report.id)
        .order_by(ReportSchedule.id.asc())
    ).all()
    return rows


@router.post(
    "/{report_id}/schedules", response_model=ReportScheduleOut, status_code=201
)
def create_schedule(
    report_id: int,
    body: ReportScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_STAFF),
):
    report = _get_visible_report(report_id, db, current_user)
    if not _can_edit(report, current_user, db):
        raise HTTPException(403, "Not permitted")
    try:
        next_run = _compute_next_run(body.cron_expr)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, f"Invalid cron expression: {exc}")

    payload = body.model_dump()
    payload["recipients_emails"] = [str(e) for e in payload.get("recipients_emails", [])]

    sched = ReportSchedule(
        **payload,
        report_id=report.id,
        created_by_id=current_user.id,
        next_run_at=next_run,
    )
    db.add(sched)
    db.commit()
    db.refresh(sched)
    return sched


@router.put(
    "/{report_id}/schedules/{schedule_id}", response_model=ReportScheduleOut
)
def update_schedule(
    report_id: int,
    schedule_id: int,
    body: ReportScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_STAFF),
):
    report = _get_visible_report(report_id, db, current_user)
    if not _can_edit(report, current_user, db):
        raise HTTPException(403, "Not permitted")
    sched = db.get(ReportSchedule, schedule_id)
    if not sched or sched.report_id != report.id:
        raise HTTPException(404, "Schedule not found")

    updates = body.model_dump(exclude_unset=True)
    if "recipients_emails" in updates:
        updates["recipients_emails"] = [str(e) for e in updates["recipients_emails"] or []]
    if "cron_expr" in updates:
        try:
            sched.next_run_at = _compute_next_run(updates["cron_expr"])
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(400, f"Invalid cron expression: {exc}")
    for k, v in updates.items():
        setattr(sched, k, v)
    db.commit()
    db.refresh(sched)
    return sched


@router.delete("/{report_id}/schedules/{schedule_id}", status_code=204)
def delete_schedule(
    report_id: int,
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_STAFF),
):
    report = _get_visible_report(report_id, db, current_user)
    if not _can_edit(report, current_user, db):
        raise HTTPException(403, "Not permitted")
    sched = db.get(ReportSchedule, schedule_id)
    if not sched or sched.report_id != report.id:
        raise HTTPException(404, "Schedule not found")
    db.delete(sched)
    db.commit()


@router.post("/{report_id}/schedules/{schedule_id}/run-now", response_model=ReportScheduleOut)
def run_schedule_now(
    report_id: int,
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_STAFF),
):
    """Force-run a schedule immediately (for testing). Uses the same delivery path."""
    from app.services.reports.scheduler import execute_schedule

    report = _get_visible_report(report_id, db, current_user)
    if not _can_edit(report, current_user, db):
        raise HTTPException(403, "Not permitted")
    sched = db.get(ReportSchedule, schedule_id)
    if not sched or sched.report_id != report.id:
        raise HTTPException(404, "Schedule not found")
    execute_schedule(db, sched)
    db.refresh(sched)
    return sched
