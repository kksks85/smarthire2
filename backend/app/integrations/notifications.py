"""Notification dispatch (email / SMS). Stubbed for v1 — logs and enqueues.

Automated providers (e.g. MSG91, Twilio, SES) can be wired into the worker
tasks later without changing call sites.
"""

import logging

logger = logging.getLogger("smarthire.notifications")


def send_email(to: str, subject: str, body: str) -> None:
    logger.info("EMAIL -> %s | %s", to, subject)


def send_sms(to: str, message: str) -> None:
    logger.info("SMS -> %s | %s", to, message)
