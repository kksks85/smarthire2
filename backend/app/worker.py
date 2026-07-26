from celery import Celery
from celery.schedules import schedule
from celery.utils.log import get_task_logger

from app.core.config import settings

celery_app = Celery(
    "smarthire",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.task_track_started = True
celery_app.conf.timezone = "UTC"

logger = get_task_logger(__name__)


# ---------------------------------------------------------------------------
# Beat schedule
# ---------------------------------------------------------------------------

celery_app.conf.beat_schedule = {
    "email-drain-outbound": {
        "task": "email.drain_outbound",
        "schedule": schedule(run_every=settings.EMAIL_OUTBOUND_INTERVAL_SECONDS),
    },
    "email-poll-inbound": {
        "task": "email.poll_inbound",
        "schedule": schedule(run_every=settings.EMAIL_POLL_INTERVAL_SECONDS),
    },
    "reports-tick": {
        "task": "reports.tick",
        "schedule": schedule(run_every=60),
    },
}


def _new_session():
    """Open a fresh SQLAlchemy session for a Celery task."""
    # Import here to avoid loading FastAPI at Celery import time.
    from app.db.session import SessionLocal  # type: ignore

    return SessionLocal()


@celery_app.task(name="email.drain_outbound")
def email_drain_outbound() -> int:
    """Send any queued outbound email messages."""
    from app.services.email import transport  # local import

    with _new_session() as db:
        return transport.drain_outbound_queue(db)


@celery_app.task(name="email.poll_inbound")
def email_poll_inbound() -> dict[str, int]:
    """Poll every active email account for new inbound messages."""
    from sqlalchemy import select

    from app.models.email import EmailAccount
    from app.services.email import transport  # local import

    results: dict[str, int] = {}
    with _new_session() as db:
        account_ids = db.scalars(
            select(EmailAccount.id).where(
                EmailAccount.is_active.is_(True),
                EmailAccount.imap_host.is_not(None),
            )
        ).all()
        for aid in account_ids:
            try:
                results[str(aid)] = transport.poll_account(db, aid)
            except Exception as exc:  # noqa: BLE001
                logger.exception("Poll failed for account %s: %s", aid, exc)
                results[str(aid)] = -1
    return results


@celery_app.task(name="email.send_now")
def email_send_now(message_id: int) -> str:
    """Send a specific queued message immediately (used for hot-path fan-out)."""
    from app.services.email import transport  # local import

    with _new_session() as db:
        msg = transport.send_message(db, message_id)
        return msg.status


@celery_app.task(name="reports.tick")
def reports_tick() -> int:
    """Execute any scheduled reports whose next_run_at has elapsed."""
    from app.services.reports import scheduler as reports_scheduler

    with _new_session() as db:
        return reports_scheduler.tick(db)
