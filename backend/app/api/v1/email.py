"""Admin/staff endpoints for the email subsystem."""

from __future__ import annotations

import logging
import smtplib
import ssl
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.crypto import decrypt_secret, encrypt_secret
from app.core.deps import require_roles
from app.core.enums import RoleName
from app.db.session import get_db
from app.models.email import (
    EmailAccount,
    EmailAttachment,
    EmailMessage,
    EmailRule,
    EmailTemplate,
)
from app.models.user import User
from app.schemas.email import (
    EmailAccountCreate,
    EmailAccountOut,
    EmailAccountTestResult,
    EmailAccountUpdate,
    EmailComposeRequest,
    EmailFromTemplateRequest,
    EmailMessageDetail,
    EmailMessageOut,
    EmailRuleCreate,
    EmailRuleOut,
    EmailRuleUpdate,
    EmailTemplateCreate,
    EmailTemplateOut,
    EmailTemplatePreviewRequest,
    EmailTemplatePreviewResponse,
    EmailTemplateUpdate,
    MergeContextFields,
    MergeField,
)
from app.services.email import dispatch, template_engine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/email", tags=["email"])

_ADMIN = require_roles(RoleName.ADMIN)
_OVERSIGHT = require_roles(RoleName.ADMIN, RoleName.MANAGER)
_STAFF = require_roles(
    RoleName.ADMIN, RoleName.MANAGER, RoleName.RECRUITER, RoleName.FIELD_AGENT
)


# ---------------------------------------------------------------------------
# Accounts
# ---------------------------------------------------------------------------

def _account_out(a: EmailAccount) -> EmailAccountOut:
    return EmailAccountOut(
        id=a.id,
        name=a.name,
        from_address=a.from_address,
        from_display_name=a.from_display_name,
        smtp_host=a.smtp_host,
        smtp_port=a.smtp_port,
        smtp_username=a.smtp_username,
        smtp_use_tls=a.smtp_use_tls,
        smtp_use_ssl=a.smtp_use_ssl,
        imap_host=a.imap_host,
        imap_port=a.imap_port,
        imap_username=a.imap_username,
        imap_use_ssl=a.imap_use_ssl,
        imap_folder=a.imap_folder,
        is_default_outbound=a.is_default_outbound,
        is_active=a.is_active,
        has_smtp_password=bool(a.smtp_password_enc),
        has_imap_password=bool(a.imap_password_enc),
        last_polled_at=a.last_polled_at,
        last_poll_error=a.last_poll_error,
        created_at=a.created_at,
    )


@router.get("/accounts", response_model=list[EmailAccountOut])
def list_accounts(db: Session = Depends(get_db), _: User = Depends(_ADMIN)):
    rows = db.scalars(select(EmailAccount).order_by(EmailAccount.name.asc())).all()
    return [_account_out(r) for r in rows]


@router.post("/accounts", response_model=EmailAccountOut, status_code=201)
def create_account(
    body: EmailAccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_ADMIN),
):
    if body.is_default_outbound:
        # Only one default at a time.
        db.execute(
            EmailAccount.__table__.update().values(is_default_outbound=False)
        )

    account = EmailAccount(
        name=body.name,
        from_address=body.from_address,
        from_display_name=body.from_display_name,
        smtp_host=body.smtp_host,
        smtp_port=body.smtp_port,
        smtp_username=body.smtp_username,
        smtp_password_enc=encrypt_secret(
            body.smtp_password.get_secret_value() if body.smtp_password else None
        ),
        smtp_use_tls=body.smtp_use_tls,
        smtp_use_ssl=body.smtp_use_ssl,
        imap_host=body.imap_host,
        imap_port=body.imap_port,
        imap_username=body.imap_username,
        imap_password_enc=encrypt_secret(
            body.imap_password.get_secret_value() if body.imap_password else None
        ),
        imap_use_ssl=body.imap_use_ssl,
        imap_folder=body.imap_folder or "INBOX",
        is_default_outbound=body.is_default_outbound,
        is_active=body.is_active,
        created_by_id=current_user.id,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return _account_out(account)


@router.put("/accounts/{account_id}", response_model=EmailAccountOut)
def update_account(
    account_id: int,
    body: EmailAccountUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(_ADMIN),
):
    account = db.get(EmailAccount, account_id)
    if not account:
        raise HTTPException(404, "Account not found")

    payload = body.model_dump(exclude_unset=True)

    if payload.get("is_default_outbound"):
        db.execute(EmailAccount.__table__.update().values(is_default_outbound=False))

    if "smtp_password" in payload:
        pw = payload.pop("smtp_password")
        account.smtp_password_enc = encrypt_secret(
            pw.get_secret_value() if hasattr(pw, "get_secret_value") else pw
        )
    if "imap_password" in payload:
        pw = payload.pop("imap_password")
        account.imap_password_enc = encrypt_secret(
            pw.get_secret_value() if hasattr(pw, "get_secret_value") else pw
        )

    for k, v in payload.items():
        setattr(account, k, v)
    db.commit()
    db.refresh(account)
    return _account_out(account)


@router.delete("/accounts/{account_id}", status_code=204)
def delete_account(
    account_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(_ADMIN),
):
    account = db.get(EmailAccount, account_id)
    if not account:
        raise HTTPException(404, "Account not found")
    db.delete(account)
    db.commit()


@router.post("/accounts/{account_id}/test", response_model=EmailAccountTestResult)
def test_account(
    account_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(_ADMIN),
):
    """Attempt SMTP login (no message sent) and IMAP login. Returns per-leg status."""
    account = db.get(EmailAccount, account_id)
    if not account:
        raise HTTPException(404, "Account not found")

    smtp_ok, smtp_err = False, None
    if account.smtp_host and account.smtp_username:
        try:
            password = decrypt_secret(account.smtp_password_enc) or ""
            port = account.smtp_port or (465 if account.smtp_use_ssl else 587)
            if account.smtp_use_ssl:
                with smtplib.SMTP_SSL(
                    account.smtp_host, port, context=ssl.create_default_context(), timeout=15
                ) as srv:
                    srv.login(account.smtp_username, password)
            else:
                with smtplib.SMTP(account.smtp_host, port, timeout=15) as srv:
                    srv.ehlo()
                    if account.smtp_use_tls:
                        srv.starttls(context=ssl.create_default_context())
                        srv.ehlo()
                    srv.login(account.smtp_username, password)
            smtp_ok = True
        except Exception as exc:  # noqa: BLE001
            smtp_err = str(exc)[:500]
    else:
        smtp_err = "SMTP not configured"

    imap_ok, imap_err = False, None
    if account.imap_host and account.imap_username:
        try:
            from imap_tools import MailBox  # type: ignore

            password = decrypt_secret(account.imap_password_enc) or ""
            with MailBox(account.imap_host, port=account.imap_port or 993).login(
                account.imap_username, password, initial_folder=account.imap_folder or "INBOX"
            ):
                imap_ok = True
        except Exception as exc:  # noqa: BLE001
            imap_err = str(exc)[:500]
    else:
        imap_err = "IMAP not configured"

    return EmailAccountTestResult(
        smtp_ok=smtp_ok, smtp_error=smtp_err, imap_ok=imap_ok, imap_error=imap_err
    )


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------

@router.get("/templates", response_model=list[EmailTemplateOut])
def list_templates(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(_OVERSIGHT),
):
    stmt = select(EmailTemplate).order_by(EmailTemplate.name.asc())
    if not include_inactive:
        stmt = stmt.where(EmailTemplate.is_active.is_(True))
    return db.scalars(stmt).all()


@router.post("/templates", response_model=EmailTemplateOut, status_code=201)
def create_template(
    body: EmailTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_OVERSIGHT),
):
    template = EmailTemplate(**body.model_dump(), created_by_id=current_user.id)
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.get("/templates/merge-fields", response_model=list[MergeContextFields])
def merge_fields(_: User = Depends(_OVERSIGHT)):
    result: list[MergeContextFields] = []
    for key, spec in template_engine.MERGE_CATALOG.items():
        fields: list[MergeField] = []
        for name, label in spec["fields"]:
            # System fields already include the "system." prefix in the catalog.
            if key == "system":
                token = f"{{{{ {name} }}}}"
            else:
                token = f"{{{{ {key}.{name} }}}}"
            fields.append(MergeField(token=token, label=label))
        result.append(MergeContextFields(context=key, label=spec["label"], fields=fields))
    return result


@router.put("/templates/{template_id}", response_model=EmailTemplateOut)
def update_template(
    template_id: int,
    body: EmailTemplateUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(_OVERSIGHT),
):
    template = db.get(EmailTemplate, template_id)
    if not template:
        raise HTTPException(404, "Template not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(template, k, v)
    db.commit()
    db.refresh(template)
    return template


@router.delete("/templates/{template_id}", status_code=204)
def delete_template(
    template_id: int, db: Session = Depends(get_db), _: User = Depends(_OVERSIGHT)
):
    template = db.get(EmailTemplate, template_id)
    if not template:
        raise HTTPException(404, "Template not found")
    db.delete(template)
    db.commit()


@router.post("/templates/preview", response_model=EmailTemplatePreviewResponse)
def preview_template(
    body: EmailTemplatePreviewRequest,
    db: Session = Depends(get_db),
    _: User = Depends(_OVERSIGHT),
):
    subject, html, text, ctx = template_engine.render_template(
        db,
        subject=body.subject,
        body_html=body.body_html,
        body_text=body.body_text,
        merge_context=body.merge_context,
        entity_id=body.entity_id,
    )
    return EmailTemplatePreviewResponse(
        subject=subject, body_html=html, body_text=text, context_used=ctx
    )


# ---------------------------------------------------------------------------
# Rules
# ---------------------------------------------------------------------------

@router.get("/rules", response_model=list[EmailRuleOut])
def list_rules(
    direction: Optional[str] = Query(None, pattern="^(inbound|outbound)$"),
    db: Session = Depends(get_db),
    _: User = Depends(_OVERSIGHT),
):
    stmt = select(EmailRule).order_by(EmailRule.priority.asc(), EmailRule.id.asc())
    if direction:
        stmt = stmt.where(EmailRule.direction == direction)
    return db.scalars(stmt).all()


@router.post("/rules", response_model=EmailRuleOut, status_code=201)
def create_rule(
    body: EmailRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_OVERSIGHT),
):
    rule = EmailRule(**body.model_dump(), created_by_id=current_user.id)
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.put("/rules/{rule_id}", response_model=EmailRuleOut)
def update_rule(
    rule_id: int,
    body: EmailRuleUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(_OVERSIGHT),
):
    rule = db.get(EmailRule, rule_id)
    if not rule:
        raise HTTPException(404, "Rule not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(rule, k, v)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/rules/{rule_id}", status_code=204)
def delete_rule(
    rule_id: int, db: Session = Depends(get_db), _: User = Depends(_OVERSIGHT)
):
    rule = db.get(EmailRule, rule_id)
    if not rule:
        raise HTTPException(404, "Rule not found")
    db.delete(rule)
    db.commit()


# ---------------------------------------------------------------------------
# Messages / Mailbox
# ---------------------------------------------------------------------------

def _message_row(msg: EmailMessage, attach_count: int) -> EmailMessageOut:
    return EmailMessageOut(
        id=msg.id,
        direction=msg.direction,
        account_id=msg.account_id,
        template_id=msg.template_id,
        rule_id=msg.rule_id,
        message_id=msg.message_id,
        thread_id=msg.thread_id,
        from_address=msg.from_address,
        from_name=msg.from_name,
        to_addresses=msg.to_addresses,
        cc_addresses=msg.cc_addresses,
        bcc_addresses=msg.bcc_addresses,
        subject=msg.subject,
        snippet=msg.snippet,
        status=msg.status,
        error_detail=msg.error_detail,
        related_candidate_id=msg.related_candidate_id,
        related_application_id=msg.related_application_id,
        related_job_id=msg.related_job_id,
        sent_at=msg.sent_at,
        received_at=msg.received_at,
        created_at=msg.created_at,
        attachment_count=attach_count,
    )


@router.get("/messages", response_model=list[EmailMessageOut])
def list_messages(
    direction: Optional[str] = Query(None, pattern="^(inbound|outbound)$"),
    status: Optional[str] = None,
    candidate_id: Optional[int] = None,
    q: Optional[str] = None,
    limit: int = 200,
    db: Session = Depends(get_db),
    _: User = Depends(_STAFF),
):
    stmt = select(EmailMessage).order_by(EmailMessage.created_at.desc()).limit(limit)
    if direction:
        stmt = stmt.where(EmailMessage.direction == direction)
    if status:
        stmt = stmt.where(EmailMessage.status == status)
    if candidate_id:
        stmt = stmt.where(EmailMessage.related_candidate_id == candidate_id)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            (EmailMessage.subject.ilike(like))
            | (EmailMessage.from_address.ilike(like))
            | (EmailMessage.snippet.ilike(like))
        )

    rows = db.scalars(stmt).all()

    # batch attachment counts
    ids = [m.id for m in rows]
    counts: dict[int, int] = {}
    if ids:
        for mid, cnt in db.execute(
            select(EmailAttachment.message_id, func.count(EmailAttachment.id))
            .where(EmailAttachment.message_id.in_(ids))
            .group_by(EmailAttachment.message_id)
        ).all():
            counts[mid] = cnt

    return [_message_row(m, counts.get(m.id, 0)) for m in rows]


@router.get("/messages/{message_id}", response_model=EmailMessageDetail)
def get_message(
    message_id: int, db: Session = Depends(get_db), _: User = Depends(_STAFF)
):
    msg = db.get(EmailMessage, message_id)
    if not msg:
        raise HTTPException(404, "Message not found")
    return EmailMessageDetail(
        **_message_row(msg, len(msg.attachments)).model_dump(),
        body_html=msg.body_html,
        body_text=msg.body_text,
        attachments=[
            {
                "id": a.id,
                "original_filename": a.original_filename,
                "content_type": a.content_type,
                "size_bytes": a.size_bytes,
            }
            for a in msg.attachments
        ],
    )


@router.post("/messages", response_model=EmailMessageOut, status_code=201)
def compose_message(
    body: EmailComposeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(_STAFF),
):
    msg = dispatch.compose_and_queue(
        db,
        account_id=body.account_id,
        to_addresses=[str(a) for a in body.to_addresses],
        cc_addresses=[str(a) for a in body.cc_addresses],
        bcc_addresses=[str(a) for a in body.bcc_addresses],
        subject=body.subject,
        body_html=body.body_html,
        body_text=body.body_text,
        related_candidate_id=body.related_candidate_id,
        related_application_id=body.related_application_id,
        related_job_id=body.related_job_id,
        created_by_id=current_user.id,
        send_now=True,
    )
    return _message_row(msg, 0)


@router.post("/messages/from-template", response_model=EmailMessageOut, status_code=201)
def send_from_template_endpoint(
    body: EmailFromTemplateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(_STAFF),
):
    msg = dispatch.send_from_template(
        db,
        template_id=body.template_id,
        to_addresses=[str(a) for a in body.to_addresses],
        entity_id=body.entity_id,
        account_id=body.account_id,
        cc_addresses=[str(a) for a in body.cc_addresses],
        bcc_addresses=[str(a) for a in body.bcc_addresses],
        related_candidate_id=body.related_candidate_id,
        related_application_id=body.related_application_id,
        related_job_id=body.related_job_id,
        created_by_id=current_user.id,
        send_now=True,
    )
    if msg is None:
        raise HTTPException(400, "Template missing or inactive")
    return _message_row(msg, 0)
