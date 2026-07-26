"""Symmetric-encryption helpers used to protect SMTP/IMAP passwords at rest.

We use Fernet (AES128-CBC + HMAC) via the ``cryptography`` library. The key
comes from :attr:`app.core.config.Settings.EMAIL_ENCRYPTION_KEY`.
"""

from __future__ import annotations

from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


@lru_cache
def _fernet() -> Fernet:
    key = settings.EMAIL_ENCRYPTION_KEY.encode("utf-8")
    return Fernet(key)


def encrypt_secret(plaintext: str | None) -> str | None:
    """Encrypt a UTF-8 string; returns None if input is falsy."""
    if not plaintext:
        return None
    return _fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_secret(ciphertext: str | None) -> str | None:
    """Decrypt a Fernet token stored in the DB. Returns None on failure."""
    if not ciphertext:
        return None
    try:
        return _fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return None
