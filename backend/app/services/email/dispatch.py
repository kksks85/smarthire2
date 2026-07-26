"""High-level helpers for other subsystems to send email.

Handles the boilerplate of picking the outbound account, rendering a template,
persisting the :class:`EmailMessage`, and optionally sending immediately (or
leaving it for the Celery drain task).
"""

from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.email import EmailAccount, EmailMessage, EmailRule, EmailTemplate
from app.services.email import template_engine, transport

logger = logging.getLogger(__name__)


def default_outbound_account(db: Session) -> Optional[EmailAccount]:
    return db.scalars(
        select(EmailAccount)
        .where(EmailAccount.is_default_outbound.is_(True), EmailAccount.is_active.is_(True))
        .limit(1)
    ).first()


def _snippet(html: Optional[str], text: Optional[str]) -> str:
    src = text or html or ""
    return src[:400]


def compose_and_queue(
    db: Session,
    *,
    account_id: Optional[int],
    to_addresses: list[str],
    subject: str,
    body_html: Optional[str] = None,
    body_text: Optional[str] = None,
    cc_addresses: Optional[list[str]] = None,
    bcc_addresses: Optional[list[str]] = None,
    template_id: Optional[int] = None,
    rule_id: Optional[int] = None,
    related_candidate_id: Optional[int] = None,
    related_application_id: Optional[int] = None,
    related_job_id: Optional[int] = None,
    created_by_id: Optional[int] = None,
    send_now: bool = True,
) -> EmailMessage:
    """Persist an outbound message. Sends it immediately when ``send_now``."""
    if not account_id:
        acct = default_outbound_account(db)
        account_id = acct.id if acct else None

    msg = EmailMessage(
        direction="outbound",
        account_id=account_id,
        template_id=template_id,
        rule_id=rule_id,
        to_addresses=to_addresses,
        cc_addresses=cc_addresses or [],
        bcc_addresses=bcc_addresses or [],
        subject=(subject or "")[:1000],
        body_html=body_html,
        body_text=body_text,
        snippet=_snippet(body_html, body_text),
        status="queued",
        related_candidate_id=related_candidate_id,
        related_application_id=related_application_id,
        related_job_id=related_job_id,
        created_by_id=created_by_id,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    if send_now:
        try:
            transport.send_message(db, msg.id)
            db.refresh(msg)
        except Exception:  # noqa: BLE001
            logger.exception("Immediate send failed; message remains queued")
    return msg


def send_from_template(
    db: Session,
    *,
    template_id: int,
    to_addresses: list[str],
    entity_id: Optional[int] = None,
    account_id: Optional[int] = None,
    cc_addresses: Optional[list[str]] = None,
    bcc_addresses: Optional[list[str]] = None,
    rule_id: Optional[int] = None,
    related_candidate_id: Optional[int] = None,
    related_application_id: Optional[int] = None,
    related_job_id: Optional[int] = None,
    created_by_id: Optional[int] = None,
    send_now: bool = True,
) -> Optional[EmailMessage]:
    template = db.get(EmailTemplate, template_id)
    if not template or not template.is_active:
        logger.warning("Template %s missing or inactive; skipping send", template_id)
        return None
    subject, body_html, body_text, _ctx = template_engine.render_template(
        db,
        subject=template.subject,
        body_html=template.body_html,
        body_text=template.body_text,
        merge_context=template.merge_context,
        entity_id=entity_id,
    )
    return compose_and_queue(
        db,
        account_id=account_id,
        to_addresses=to_addresses,
        subject=subject,
        body_html=body_html,
        body_text=body_text,
        cc_addresses=cc_addresses,
        bcc_addresses=bcc_addresses,
        template_id=template_id,
        rule_id=rule_id,
        related_candidate_id=related_candidate_id,
        related_application_id=related_application_id,
        related_job_id=related_job_id,
        created_by_id=created_by_id,
        send_now=send_now,
    )


def fire_trigger(
    db: Session,
    *,
    trigger_event: str,
    to_addresses: list[str],
    entity_id: Optional[int] = None,
    **relations,
) -> list[EmailMessage]:
    """Find active outbound rules for a trigger and send each mapped template.

    Called by other services (candidate registered, job posted, …) — safe
    no-op when no rules exist. Never raises; logs failures.
    """
    rules = db.scalars(
        select(EmailRule)
        .where(
            EmailRule.direction == "outbound",
            EmailRule.trigger_event == trigger_event,
            EmailRule.is_active.is_(True),
        )
        .order_by(EmailRule.priority.asc(), EmailRule.id.asc())
    ).all()

    results: list[EmailMessage] = []
    for rule in rules:
        if rule.action_type != "send_template" or not rule.template_id:
            continue
        try:
            msg = send_from_template(
                db,
                template_id=rule.template_id,
                to_addresses=to_addresses,
                entity_id=entity_id,
                account_id=rule.account_id,
                rule_id=rule.id,
                **relations,
            )
            if msg:
                results.append(msg)
        except Exception:  # noqa: BLE001
            logger.exception("Trigger %s: rule %s failed", trigger_event, rule.id)
    return results
