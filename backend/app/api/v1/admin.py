from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.crypto import encrypt_secret
from app.core.deps import require_roles
from app.core.enums import RoleName
from app.db.session import get_db
from app.models.audit import AuditLog, PiiAccessLog
from app.models.candidate import Candidate
from app.models.public_site import PublicSiteSettings
from app.models.user import User
from app.models.whatsapp import WhatsAppSettings
from app.services.audit import record_audit

router = APIRouter(prefix="/admin", tags=["admin"])

_ADMIN = require_roles(RoleName.ADMIN)
_OVERSIGHT = require_roles(RoleName.ADMIN, RoleName.MANAGER)


class PublicSiteSettingsOut(BaseModel):
    public_base_url: str
    using_environment_default: bool


class PublicSiteSettingsUpdate(BaseModel):
    public_base_url: HttpUrl


class WhatsAppSettingsOut(BaseModel):
    is_enabled: bool
    phone_number_id: str | None = None
    graph_api_version: str
    template_name: str | None = None
    template_language: str
    has_access_token: bool


class WhatsAppSettingsUpdate(BaseModel):
    is_enabled: bool
    phone_number_id: str | None = Field(default=None, max_length=128)
    graph_api_version: str = Field(default="v21.0", pattern=r"^v\d+\.\d+$")
    template_name: str | None = Field(default=None, max_length=512)
    template_language: str = Field(default="en", max_length=32)
    access_token: str | None = Field(default=None, min_length=1)


def get_public_base_url(db: Session) -> str:
    configured = db.get(PublicSiteSettings, 1)
    val = (configured.public_base_url if configured else settings.PUBLIC_BASE_URL).strip().rstrip("/")
    if not val.lower().startswith(("http://", "https://")):
        val = f"https://{val}"
    return val


@router.get("/public-site", response_model=PublicSiteSettingsOut)
def get_public_site_settings(
    db: Session = Depends(get_db),
    _: User = Depends(_ADMIN),
):
    configured = db.get(PublicSiteSettings, 1)
    return PublicSiteSettingsOut(
        public_base_url=get_public_base_url(db),
        using_environment_default=configured is None,
    )


@router.put("/public-site", response_model=PublicSiteSettingsOut)
def update_public_site_settings(
    body: PublicSiteSettingsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(_ADMIN),
):
    public_base_url = str(body.public_base_url).rstrip("/")
    parsed = urlparse(public_base_url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise HTTPException(status_code=422, detail="Use a publicly reachable HTTPS URL.")

    configured = db.get(PublicSiteSettings, 1)
    if configured:
        configured.public_base_url = public_base_url
    else:
        db.add(PublicSiteSettings(id=1, public_base_url=public_base_url))
    db.commit()
    return PublicSiteSettingsOut(
        public_base_url=public_base_url,
        using_environment_default=False,
    )


def _whatsapp_settings_out(configured: WhatsAppSettings | None) -> WhatsAppSettingsOut:
    return WhatsAppSettingsOut(
        is_enabled=bool(configured and configured.is_enabled),
        phone_number_id=configured.phone_number_id if configured else None,
        graph_api_version=(configured.graph_api_version if configured and configured.graph_api_version else "v21.0"),
        template_name=configured.template_name if configured else None,
        template_language=(configured.template_language if configured and configured.template_language else "en"),
        has_access_token=bool(configured and configured.access_token_enc),
    )


@router.get("/whatsapp-settings", response_model=WhatsAppSettingsOut)
def get_whatsapp_settings(
    db: Session = Depends(get_db),
    _: User = Depends(_ADMIN),
):
    return _whatsapp_settings_out(db.get(WhatsAppSettings, 1))


@router.put("/whatsapp-settings", response_model=WhatsAppSettingsOut)
def update_whatsapp_settings(
    body: WhatsAppSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_ADMIN),
):
    configured = db.get(WhatsAppSettings, 1)
    if not configured:
        configured = WhatsAppSettings(id=1)
        db.add(configured)

    configured.is_enabled = body.is_enabled
    configured.phone_number_id = body.phone_number_id.strip() if body.phone_number_id else None
    configured.graph_api_version = body.graph_api_version
    configured.template_name = body.template_name.strip() if body.template_name else None
    configured.template_language = body.template_language.strip()
    if body.access_token:
        configured.access_token_enc = encrypt_secret(body.access_token.strip())

    if configured.is_enabled and not (
        configured.phone_number_id and configured.template_name and configured.access_token_enc
    ):
        raise HTTPException(
            status_code=422,
            detail="Phone number ID, template name, and access token are required when WhatsApp is enabled.",
        )

    db.commit()
    record_audit(
        db,
        user_id=current_user.id,
        action="whatsapp.settings.update",
        entity_type="whatsapp_settings",
        entity_id=1,
        detail=f"enabled={configured.is_enabled}",
    )
    return _whatsapp_settings_out(configured)


@router.get("/audit-logs")
def audit_logs(
    limit: int = 100,
    db: Session = Depends(get_db),
    _: User = Depends(_ADMIN),
):
    rows = db.scalars(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    ).all()
    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "action": r.action,
            "entity_type": r.entity_type,
            "entity_id": r.entity_id,
            "detail": r.detail,
            "ip_address": r.ip_address,
            "created_at": r.created_at,
        }
        for r in rows
    ]


@router.get("/pii-access-logs")
def pii_access_logs(
    limit: int = 100,
    db: Session = Depends(get_db),
    _: User = Depends(_ADMIN),
):
    rows = db.scalars(
        select(PiiAccessLog).order_by(PiiAccessLog.created_at.desc()).limit(limit)
    ).all()
    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "candidate_id": r.candidate_id,
            "fields_revealed": r.fields_revealed,
            "ip_address": r.ip_address,
            "created_at": r.created_at,
        }
        for r in rows
    ]


@router.get("/pii-view-log")
def pii_view_log(
    limit: int = 200,
    db: Session = Depends(get_db),
    _: User = Depends(_OVERSIGHT),
):
    """
    Enriched PII reveal log. Every time a user unmasks a candidate's phone
    (or other PII), one row is produced here with the user, the candidate,
    the fields revealed, and the exact timestamp — used for data-safety
    audits.
    """
    rows = db.scalars(
        select(PiiAccessLog).order_by(PiiAccessLog.created_at.desc()).limit(limit)
    ).all()

    user_ids = {r.user_id for r in rows}
    cand_ids = {r.candidate_id for r in rows}

    users: dict[int, User] = {}
    if user_ids:
        users = {
            u.id: u
            for u in db.scalars(select(User).where(User.id.in_(user_ids))).all()
        }

    cands: dict[int, Candidate] = {}
    if cand_ids:
        cands = {
            c.id: c
            for c in db.scalars(
                select(Candidate).where(Candidate.id.in_(cand_ids))
            ).all()
        }

    result = []
    for r in rows:
        u = users.get(r.user_id)
        c = cands.get(r.candidate_id)
        result.append(
            {
                "id": r.id,
                "user_id": r.user_id,
                "user_name": u.full_name if u else None,
                "user_email": u.email if u else None,
                "user_role": u.role.name if u else None,
                "candidate_id": r.candidate_id,
                "candidate_name": c.full_name if c else None,
                "candidate_code": f"CAND-{r.candidate_id:05d}",
                "fields_revealed": r.fields_revealed,
                "ip_address": r.ip_address,
                "created_at": r.created_at,
            }
        )
    return result
