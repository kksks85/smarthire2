from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import KycStatus
from app.db.session import Base
from app.models.mixins import TimestampMixin


class KycDocument(Base, TimestampMixin):
    __tablename__ = "kyc_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"), nullable=False)
    application_id: Mapped[Optional[int]] = mapped_column(ForeignKey("applications.id"))

    document_type: Mapped[str] = mapped_column(String(80), nullable=False)
    file_key: Mapped[str] = mapped_column(String(512), nullable=False)  # S3 key / local path
    original_filename: Mapped[Optional[str]] = mapped_column(String(255))
    content_type: Mapped[Optional[str]] = mapped_column(String(120))

    status: Mapped[KycStatus] = mapped_column(
        String(20), default=KycStatus.SUBMITTED, nullable=False, index=True
    )
    verified_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text)
