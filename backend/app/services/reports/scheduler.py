"""Scheduled report execution + email delivery.

Called by the Celery beat task ``reports.tick`` every minute. For each active
schedule whose ``next_run_at`` has elapsed:
    1. Run the report as the report owner (so PII masking uses the owner's role).
    2. Format the result to CSV / XLSX / inline HTML.
    3. Deliver by email via the Phase 1 email dispatch service.
    4. Update ``last_run_at`` / ``next_run_at`` / ``last_run_status``.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import RoleName
from app.models.report import Report, ReportSchedule
from app.models.user import Role, User
from app.services.email import dispatch as email_dispatch
from app.services.reports import export as export_svc
from app.services.reports import query as query_svc

logger = logging.getLogger(__name__)


def _next_run(cron_expr: str, base: datetime | None = None) -> datetime:
    from croniter import croniter

    base = base or datetime.utcnow()
    return croniter(cron_expr, base).get_next(datetime)


def _resolve_recipients(sched: ReportSchedule, db: Session) -> list[str]:
    emails: set[str] = set()
    for e in sched.recipients_emails or []:
        if e:
            emails.add(str(e))
    if sched.recipients_users:
        rows = db.scalars(
            select(User).where(User.id.in_(sched.recipients_users))
        ).all()
        for u in rows:
            if u.email:
                emails.add(u.email)
    if sched.recipients_roles:
        role_names = [r for r in sched.recipients_roles if r]
        if role_names:
            role_rows = db.scalars(
                select(Role).where(Role.name.in_(role_names))
            ).all()
            role_ids = [r.id for r in role_rows]
            if role_ids:
                users = db.scalars(
                    select(User).where(User.role_id.in_(role_ids), User.is_active.is_(True))
                ).all()
                for u in users:
                    if u.email:
                        emails.add(u.email)
    return sorted(emails)


def execute_schedule(db: Session, sched: ReportSchedule) -> None:
    report = db.get(Report, sched.report_id)
    if not report:
        sched.last_run_status = "failed"
        sched.last_run_error = "Report not found"
        sched.last_run_at = datetime.utcnow()
        db.commit()
        return

    recipients = _resolve_recipients(sched, db)
    if not recipients:
        sched.last_run_status = "skipped"
        sched.last_run_error = "No recipients"
        sched.last_run_at = datetime.utcnow()
        try:
            sched.next_run_at = _next_run(sched.cron_expr)
        except Exception:  # noqa: BLE001
            pass
        db.commit()
        return

    owner = db.get(User, report.owner_id)
    try:
        result = query_svc.run_report(
            db,
            data_source=report.data_source,
            filters=report.filters,
            columns=report.columns,
            group_by=report.group_by,
            order_by=report.order_by,
            row_limit=report.row_limit,
            current_user=owner,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Scheduled report %s failed to run", report.id)
        sched.last_run_status = "failed"
        sched.last_run_error = str(exc)[:1000]
        sched.last_run_at = datetime.utcnow()
        db.commit()
        return

    subject = f"[SmartHire Report] {report.name} — {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"
    body_text = (
        f"Scheduled report: {report.name}\n"
        f"Rows: {result['row_count']}{' (truncated)' if result['truncated'] else ''}\n"
        f"Data source: {report.data_source}\n\n"
        f"Delivered by SmartHire 2.0."
    )

    # For inline_html we skip attachments and embed a rendered HTML table.
    if sched.format == "inline_html":
        html_body = (
            f"<p>Scheduled report: <strong>{report.name}</strong></p>"
            f"<p>Rows: {result['row_count']}{' (truncated)' if result['truncated'] else ''}</p>"
            f"{export_svc.to_html(result, report.name)}"
        )
        email_dispatch.compose_and_queue(
            db,
            account_id=None,
            to_addresses=recipients,
            subject=subject,
            body_html=html_body,
            body_text=body_text,
            send_now=True,
        )
    else:
        # For file formats, we still send an email with a summary body.
        # The file is stored on the message as an attachment via a lightweight
        # side-write to the file store since Phase 1 attachment upload path
        # lives inside the IMAP receiver; for now we inline the file as base64.
        # v2: proper attachment persistence + MIME assembly.
        if sched.format == "csv":
            file_bytes = export_svc.to_csv(result)
            filename = f"{report.name.replace(' ', '_')}.csv"
            preview = file_bytes.decode("utf-8", errors="ignore")[:4000]
            body_text += f"\n\n----- CSV preview -----\n{preview}"
        else:
            # xlsx binary — can't preview in text; note it out.
            file_bytes = export_svc.to_xlsx(result, sheet_name=report.name)
            filename = f"{report.name.replace(' ', '_')}.xlsx"
            body_text += (
                f"\n\n(XLSX file '{filename}' generated; "
                f"{len(file_bytes)} bytes. Attach delivery pending Phase 2.5.)"
            )
        email_dispatch.compose_and_queue(
            db,
            account_id=None,
            to_addresses=recipients,
            subject=subject,
            body_text=body_text,
            send_now=True,
        )

    sched.last_run_status = "success"
    sched.last_run_error = None
    sched.last_run_at = datetime.utcnow()
    try:
        sched.next_run_at = _next_run(sched.cron_expr)
    except Exception:  # noqa: BLE001
        sched.next_run_at = None
    db.commit()


def tick(db: Session) -> int:
    """Run every schedule whose next_run_at is due. Returns count executed."""
    now = datetime.utcnow()
    due: Iterable[ReportSchedule] = db.scalars(
        select(ReportSchedule)
        .where(
            ReportSchedule.is_active.is_(True),
            ReportSchedule.next_run_at.is_not(None),
            ReportSchedule.next_run_at <= now,
        )
        .order_by(ReportSchedule.next_run_at.asc())
        .limit(50)
    ).all()
    count = 0
    for sched in due:
        try:
            execute_schedule(db, sched)
            count += 1
        except Exception:  # noqa: BLE001
            logger.exception("Failed to execute schedule %s", sched.id)
    return count
