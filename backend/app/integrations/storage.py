"""Storage abstraction: S3 in production, local disk in dev."""

import os
import uuid

from app.core.config import settings


class StorageService:
    def __init__(self) -> None:
        self.use_local = settings.STORAGE_USE_LOCAL
        if not self.use_local:
            import boto3

            self._client = boto3.client(
                "s3",
                region_name=settings.S3_REGION,
                endpoint_url=settings.S3_ENDPOINT_URL or None,
                aws_access_key_id=settings.S3_ACCESS_KEY or None,
                aws_secret_access_key=settings.S3_SECRET_KEY or None,
            )
        else:
            os.makedirs(settings.LOCAL_STORAGE_DIR, exist_ok=True)

    def save(self, data: bytes, filename: str, content_type: str | None = None) -> str:
        key = f"{uuid.uuid4().hex}_{filename}"
        if self.use_local:
            path = os.path.join(settings.LOCAL_STORAGE_DIR, key)
            with open(path, "wb") as f:
                f.write(data)
            return key
        self._client.put_object(
            Bucket=settings.S3_BUCKET,
            Key=key,
            Body=data,
            ContentType=content_type or "application/octet-stream",
        )
        return key

    def presigned_url(self, key: str, expires: int = 3600) -> str:
        if self.use_local:
            return f"/api/v1/kyc/file/{key}"
        return self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.S3_BUCKET, "Key": key},
            ExpiresIn=expires,
        )

    def read_local(self, key: str) -> bytes:
        path = os.path.join(settings.LOCAL_STORAGE_DIR, key)
        with open(path, "rb") as f:
            return f.read()


storage = StorageService()
