"""Sentry initialisation and capture helper — imported by lifecycle and factory."""

import logging
import re

from app.config import settings

logger = logging.getLogger(__name__)

# Headers that carry credentials — never ship their values to Sentry.
_SENSITIVE_HEADERS = {"authorization", "cookie", "x-admin-key", "x-api-key"}
# Coarse patterns for secrets that might leak into an exception/log message.
_SECRET_PATTERNS = [
    re.compile(r"Bearer\s+[A-Za-z0-9._\-]+", re.IGNORECASE),
    re.compile(r"eyJ[A-Za-z0-9._\-]+"),  # JWT-looking blobs
    re.compile(r"sk-or-[A-Za-z0-9._\-]+"),  # OpenRouter keys
]


def _redact(text: str) -> str:
    for pat in _SECRET_PATTERNS:
        text = pat.sub("[REDACTED]", text)
    return text


def _before_send(event: dict, _hint: object) -> dict:
    """Strip credential headers and redact secret-looking strings before upload."""
    try:
        headers = event.get("request", {}).get("headers")
        if isinstance(headers, dict):
            for k in list(headers):
                if k.lower() in _SENSITIVE_HEADERS:
                    headers[k] = "[REDACTED]"
        for exc in event.get("exception", {}).get("values", []) or []:
            if isinstance(exc.get("value"), str):
                exc["value"] = _redact(exc["value"])
    except Exception:  # never let scrubbing crash error reporting
        pass
    return event


def init_sentry() -> None:
    if not settings.sentry_dsn:
        return
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.sentry_environment,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        integrations=[FastApiIntegration(), SqlalchemyIntegration()],
        send_default_pii=False,
        before_send=_before_send,
    )
    logger.info("Sentry initialised (env=%s)", settings.sentry_environment)


def capture(exc: Exception) -> None:
    if settings.sentry_dsn:
        import sentry_sdk

        sentry_sdk.capture_exception(exc)
