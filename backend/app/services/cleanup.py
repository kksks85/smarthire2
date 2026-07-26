"""Scheduled cleanup tasks for the SmartHire application."""

from datetime import datetime, timedelta, timezone
import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.audit import AgentLocationLog

logger = logging.getLogger(__name__)


def cleanup_old_location_logs(retention_days: int = 7):
    """
    Delete agent location logs older than retention_days.
    Called periodically by the scheduler (e.g., every 24 hours).
    """
    db = SessionLocal()
    try:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=retention_days)
        
        stmt = select(AgentLocationLog).where(
            AgentLocationLog.created_at < cutoff_date
        )
        old_logs = db.scalars(stmt).all()
        deleted_count = len(old_logs)
        
        for log in old_logs:
            db.delete(log)
        
        db.commit()
        logger.info(
            f"Cleanup: deleted {deleted_count} location logs older than {retention_days} days "
            f"(cutoff: {cutoff_date.isoformat()})"
        )
    except Exception as e:
        logger.error(f"Error during location log cleanup: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()
