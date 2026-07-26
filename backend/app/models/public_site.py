from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.mixins import TimestampMixin


class PublicSiteSettings(Base, TimestampMixin):
    __tablename__ = "public_site_settings"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    public_base_url: Mapped[str] = mapped_column(String(500), nullable=False)