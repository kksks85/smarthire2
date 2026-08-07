from __future__ import annotations

import re
from typing import Any

import requests

from app.core.crypto import decrypt_secret
from app.models.whatsapp import WhatsAppSettings


class WhatsAppService:
    def is_configured(self, settings: WhatsAppSettings | None) -> bool:
        return bool(
            settings
            and settings.is_enabled
            and settings.phone_number_id
            and settings.template_name
            and decrypt_secret(settings.access_token_enc)
        )

    @staticmethod
    def normalize_phone(phone: str) -> str:
        digits = re.sub(r"\D", "", phone or "")
        if len(digits) == 10:
            return f"91{digits}"
        return digits

    def _url(self, settings: WhatsAppSettings, suffix: str) -> str:
        return f"https://graph.facebook.com/{settings.graph_api_version}/{settings.phone_number_id}/{suffix}"

    def _headers(self, settings: WhatsAppSettings) -> dict[str, str]:
        return {"Authorization": f"Bearer {decrypt_secret(settings.access_token_enc)}"}

    @staticmethod
    def _raise_for_status(response: requests.Response, operation: str) -> None:
        if response.ok:
            return
        try:
            error = response.json().get("error") or {}
            detail = (error.get("error_data") or {}).get("details") or error.get("message")
            code = error.get("code")
            raise RuntimeError(
                f"WhatsApp {operation} failed"
                f"{f' (code {code})' if code else ''}: {detail or response.text}"
            )
        except ValueError:
            raise RuntimeError(f"WhatsApp {operation} failed: {response.text}")

    def upload_media(self, settings: WhatsAppSettings, image_bytes: bytes) -> str:
        response = requests.post(
            self._url(settings, "media"),
            headers=self._headers(settings),
            data={"messaging_product": "whatsapp"},
            files={"file": ("job-share-kit.jpg", image_bytes, "image/jpeg")},
            timeout=30,
        )
        self._raise_for_status(response, "media upload")
        media_id = response.json().get("id")
        if not media_id:
            raise RuntimeError("WhatsApp media upload returned no media ID")
        return str(media_id)

    def send_template(
        self,
        settings: WhatsAppSettings,
        *,
        recipient_phone: str,
        media_id: str | None = None,
        body_values: list[str] | None = None,
    ) -> str:
        components: list[dict[str, Any]] = []
        if media_id:
            components.append({
                "type": "header",
                "parameters": [{"type": "image", "image": {"id": media_id}}],
            })
        if body_values:
            components.append({
                "type": "body",
                "parameters": [{"type": "text", "text": value} for value in body_values],
            })
        response = requests.post(
            self._url(settings, "messages"),
            headers={**self._headers(settings), "Content-Type": "application/json"},
            json={
                "messaging_product": "whatsapp",
                "to": self.normalize_phone(recipient_phone),
                "type": "template",
                "template": {
                    "name": settings.template_name,
                    "language": {"code": settings.template_language},
                    "components": components,
                },
            },
            timeout=30,
        )
        self._raise_for_status(response, "template send")
        messages = response.json().get("messages") or []
        if not messages or not messages[0].get("id"):
            raise RuntimeError("WhatsApp message response contained no message ID")
        return str(messages[0]["id"])


whatsapp_service = WhatsAppService()