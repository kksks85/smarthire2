"""SMTP send + IMAP receive + inbound-rule engine.

All external network I/O lives here so the API and Celery tasks can stay
declarative.
"""

from __future__ import annotations

import logging
import smtplib
import ssl
from datetime import datetime
from email.message import EmailMessage as MIMEEmailMessage
from email.utils import formataddr
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.crypto import decrypt_secret
from app.models.email import (
    EmailAccount,
    EmailMessage,
    EmailRule,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# SMTP outbound
# ---------------------------------------------------------------------------

def _build_mime(
    *,
    from_address: str,
    from_display_name: Optional[str],
    to_addresses: list[str],
    cc_addresses: list[str],
    bcc_addresses: list[str],
    subject: str,
    body_html: Optional[str],
    body_text: Optional[str],
) -> MIMEEmailMessage:
    msg = MIMEEmailMessage()
    msg["From"] = formataddr((from_display_name or "", from_address))
    msg["To"] = ", ".join(to_addresses)
    if cc_addresses:
        msg["Cc"] = ", ".join(cc_addresses)
    msg["Subject"] = subject
    # Always set a text body (plain fallback); add HTML alternative if given.
    plain = body_text or (body_html or "").replace("<", " <")
    msg.set_content(plain or "")
    if body_html:
        msg.add_alternative(body_html, subtype="html")
    return msg


def send_via_smtp(account: EmailAccount, message: EmailMessage) -> None:
    """Send a queued EmailMessage using the account's SMTP settings.

    Raises on failure; caller must catch and update the message status.
    """
    if not account.smtp_host:
        raise RuntimeError("Account has no SMTP host configured")

    password = decrypt_secret(account.smtp_password_enc) or ""

    mime = _build_mime(
        from_address=account.from_address,
        from_display_name=account.from_display_name,
        to_addresses=message.to_addresses or [],
        cc_addresses=message.cc_addresses or [],
        bcc_addresses=message.bcc_addresses or [],
        subject=message.subject or "",
        body_html=message.body_html,
        body_text=message.body_text,
    )

    all_recipients = (
        (message.to_addresses or [])
        + (message.cc_addresses or [])
        + (message.bcc_addresses or [])
    )

    port = account.smtp_port or (465 if account.smtp_use_ssl else 587)
    if account.smtp_use_ssl:
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(account.smtp_host, port, context=ctx, timeout=30) as srv:
            if account.smtp_username:
                srv.login(account.smtp_username, password)
            srv.send_message(mime, from_addr=account.from_address, to_addrs=all_recipients)
    else:
        with smtplib.SMTP(account.smtp_host, port, timeout=30) as srv:
            srv.ehlo()
            if account.smtp_use_tls:
                srv.starttls(context=ssl.create_default_context())
                srv.ehlo()
            if account.smtp_username:
                srv.login(account.smtp_username, password)
            srv.send_message(mime, from_addr=account.from_address, to_addrs=all_recipients)


def send_message(db: Session, message_id: int) -> EmailMessage:
    """Send a single queued outbound message. Updates status in-place."""
    msg = db.get(EmailMessage, message_id)
    if not msg:
        raise RuntimeError(f"EmailMessage {message_id} not found")
    if msg.status != "queued":
        return msg

    account = db.get(EmailAccount, msg.account_id) if msg.account_id else None
    if not account:
        # Fallback to default outbound
        account = db.scalars(
            select(EmailAccount)
            .where(EmailAccount.is_default_outbound.is_(True), EmailAccount.is_active.is_(True))
            .limit(1)
        ).first()
    if not account:
        msg.status = "failed"
        msg.error_detail = "No outbound account available"
        db.commit()
        return msg

    try:
        send_via_smtp(account, msg)
        msg.status = "sent"
        msg.sent_at = datetime.utcnow()
        msg.account_id = account.id
        msg.error_detail = None
    except Exception as exc:  # noqa: BLE001
        logger.exception("SMTP send failed for message %s", message_id)
        msg.status = "failed"
        msg.error_detail = str(exc)[:1000]
    db.commit()
    return msg


def drain_outbound_queue(db: Session, max_batch: int = 50) -> int:
    """Send all queued messages. Returns count processed."""
    ids = db.scalars(
        select(EmailMessage.id)
        .where(EmailMessage.direction == "outbound", EmailMessage.status == "queued")
        .order_by(EmailMessage.created_at.asc())
        .limit(max_batch)
    ).all()
    for mid in ids:
        try:
            send_message(db, mid)
        except Exception:  # noqa: BLE001
            logger.exception("Unexpected error draining message %s", mid)
    return len(ids)


# ---------------------------------------------------------------------------
# IMAP inbound
# ---------------------------------------------------------------------------

def _import_imap_tools():
    # Local import so environments without imap-tools installed still load the
    # rest of the module for admin API usage.
    from imap_tools import MailBox, AND  # type: ignore

    return MailBox, AND


def poll_account(db: Session, account_id: int, max_fetch: int = 50) -> int:
    """Poll an IMAP account for new (unseen) messages.

    Persists them as :class:`EmailMessage` rows with direction=inbound and
    runs matching inbound :class:`EmailRule` actions.
    Returns the number of messages fetched.
    """
    account = db.get(EmailAccount, account_id)
    if not account or not account.is_active or not account.imap_host:
        return 0

    password = decrypt_secret(account.imap_password_enc) or ""
    if not account.imap_username or not password:
        return 0

    MailBox, AND = _import_imap_tools()
    fetched = 0
    try:
        with MailBox(account.imap_host, port=account.imap_port or 993).login(
            account.imap_username, password, initial_folder=account.imap_folder or "INBOX"
        ) as mailbox:
            for mail in mailbox.fetch(AND(seen=False), limit=max_fetch, mark_seen=True):
                msg = EmailMessage(
                    direction="inbound",
                    account_id=account.id,
                    message_id=mail.uid and str(mail.uid),
                    from_address=(mail.from_ or "")[:255],
                    from_name=(mail.from_values.name if mail.from_values else None) or None,
                    to_addresses=list(mail.to) if mail.to else [],
                    cc_addresses=list(mail.cc) if mail.cc else [],
                    subject=(mail.subject or "")[:1000],
                    body_text=mail.text or None,
                    body_html=mail.html or None,
                    snippet=(mail.text or mail.html or "")[:400],
                    status="received",
                    received_at=mail.date or datetime.utcnow(),
                )
                db.add(msg)
                db.flush()  # get id
                _apply_inbound_rules(db, msg)
                fetched += 1
        account.last_polled_at = datetime.utcnow()
        account.last_poll_error = None
    except Exception as exc:  # noqa: BLE001
        logger.exception("IMAP poll failed for account %s", account_id)
        account.last_poll_error = str(exc)[:1000]
        account.last_polled_at = datetime.utcnow()
    db.commit()
    return fetched


# ---------------------------------------------------------------------------
# Inbound rule engine
# ---------------------------------------------------------------------------

def _matches(rule: EmailRule, message: EmailMessage) -> bool:
    conds = rule.match_conditions or {}
    if not conds:
        return True
    fc = (conds.get("from_contains") or "").strip().lower()
    if fc and fc not in (message.from_address or "").lower():
        return False
    sc = (conds.get("subject_contains") or "").strip().lower()
    if sc and sc not in (message.subject or "").lower():
        return False
    tc = (conds.get("to_contains") or "").strip().lower()
    if tc and not any(tc in (t or "").lower() for t in (message.to_addresses or [])):
        return False
    return True


def _apply_inbound_rules(db: Session, message: EmailMessage) -> None:
    from app.services.email import dispatch  # local to avoid circular import

    rules = db.scalars(
        select(EmailRule)
        .where(EmailRule.direction == "inbound", EmailRule.is_active.is_(True))
        .order_by(EmailRule.priority.asc(), EmailRule.id.asc())
    ).all()

    for rule in rules:
        if not _matches(rule, message):
            continue

        message.rule_id = rule.id

        if rule.action_type == "auto_reply" and rule.template_id and message.from_address:
            dispatch.send_from_template(
                db,
                template_id=rule.template_id,
                to_addresses=[message.from_address],
                entity_id=None,
                account_id=rule.account_id or message.account_id,
                rule_id=rule.id,
            )
        elif rule.action_type == "forward_to":
            params = rule.action_params or {}
            fwd_to = params.get("to") or []
            if isinstance(fwd_to, str):
                fwd_to = [fwd_to]
            if fwd_to:
                dispatch.compose_and_queue(
                    db,
                    account_id=rule.account_id or message.account_id,
                    to_addresses=fwd_to,
                    subject=f"Fwd: {message.subject or ''}",
                    body_text=message.body_text,
                    body_html=message.body_html,
                    rule_id=rule.id,
                )
        # tag_as / create_lead are placeholder actions for v2 — no-op for now.
        break  # first matching rule wins
