from functools import lru_cache
from typing import Annotated, List

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=True)

    # App
    PROJECT_NAME: str = "SmartHire 2.0"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "change-me"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    # Database
    POSTGRES_SERVER: str = "db"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "smarthire"
    POSTGRES_PASSWORD: str = "smarthire"
    POSTGRES_DB: str = "smarthire"

    # Redis / Celery
    REDIS_URL: str = "redis://redis:6379/0"

    # CORS
    BACKEND_CORS_ORIGINS: Annotated[List[str], NoDecode] = ["http://localhost:5173"]

    # Storage
    S3_ENDPOINT_URL: str = ""
    S3_REGION: str = "ap-south-1"
    S3_BUCKET: str = "smarthire-kyc"
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    STORAGE_USE_LOCAL: bool = True
    LOCAL_STORAGE_DIR: str = "uploads"

    # Public links
    PUBLIC_BASE_URL: str = "http://localhost:5173"

    # LinkedIn API
    LINKEDIN_CLIENT_ID: str = ""
    LINKEDIN_CLIENT_SECRET: str = ""
    LINKEDIN_ACCESS_TOKEN: str = ""
    LINKEDIN_COMPANY_ID: str = ""

    # Seed admin
    FIRST_ADMIN_EMAIL: str = "admin@smarthire.io"
    FIRST_ADMIN_PASSWORD: str = "Admin@12345"
    FIRST_ADMIN_NAME: str = "System Administrator"

    # Email subsystem
    # Fernet key used to encrypt SMTP/IMAP passwords stored in the DB.
    # Generate once with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    # A stable default is provided for local dev only — rotate for production.
    EMAIL_ENCRYPTION_KEY: str = "kzGkQ8VZLbFqXW2N7v1kQmY8s2p7X0aC6WkP3JhH6RM="
    EMAIL_POLL_INTERVAL_SECONDS: int = 300  # 5 minutes
    EMAIL_OUTBOUND_INTERVAL_SECONDS: int = 60  # 1 minute

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def split_cors(cls, v):
        if isinstance(v, str):
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return (
            f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
