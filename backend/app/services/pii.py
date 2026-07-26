"""PII masking helpers for candidate data."""


def mask_phone(phone: str | None) -> str | None:
    if not phone:
        return phone
    digits = "".join(ch for ch in phone if ch.isdigit())
    if len(digits) < 4:
        return "*" * len(phone)
    return f"{'X' * (len(digits) - 4)}{digits[-4:]}"


def mask_email(email: str | None) -> str | None:
    if not email or "@" not in email:
        return email
    local, _, domain = email.partition("@")
    if len(local) <= 1:
        masked_local = "*"
    else:
        masked_local = local[0] + "*" * (len(local) - 1)
    return f"{masked_local}@{domain}"


def mask_address(address: str | None) -> str | None:
    if not address:
        return address
    return "•••• (hidden)"
