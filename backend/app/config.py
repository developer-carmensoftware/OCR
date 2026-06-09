"""
Application configuration — loads settings from .env file.
"""

import logging
import re
from pathlib import Path

from pydantic_settings import BaseSettings

_config_logger = logging.getLogger(__name__)

_WEAK_JWT_SECRETS = {
    "dev-ocr-jwt-secret-change-in-production",
    "secret",
    "changeme",
    "",
}
_WEAK_FERNET_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env file."""

    # OpenRouter API
    openrouter_api_key: str = ""
    openrouter_ocr_model: str = "google/gemini-2.0-flash-001"
    openrouter_ap_invoice_model: str = "google/gemini-2.0-flash-001"
    openrouter_suggestion_model: str = "google/gemini-2.0-flash-001"
    openrouter_bidding_model: str = ""
    openrouter_vendorsuggest_model: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    # Tavily search API
    tavily_api_key: str = ""

    # Master API key for service-to-service auth
    master_api_key: str = ""

    # OCR engine label (informational — actual engine is the OpenRouter vision LLM)
    ocr_engine: str = "openrouter_vision"

    # Application
    app_host: str = "0.0.0.0"
    app_port: int = 8010
    app_debug: bool = False
    # Empty default = no regex origin matching. NEVER default to ".*" — combined with
    # allow_credentials it would let any site call the API with cookies/auth.
    allowed_origin_regex: str = ""
    allowed_origins: str = "http://localhost:3010"

    # Trust X-Forwarded-For for client IP (rate-limit / admin-lockout / audit).
    # Only enable when deployed behind a trusted reverse proxy (nginx/Cloudflare).
    # When False, the spoofable XFF header is ignored and request.client.host is used.
    trust_proxy: bool = False

    # SSRF protection — comma-separated regex patterns for allowed Carmen hostnames.
    # Example: "erp\.company\.com,erp2\.company\.com"
    # Leave empty to allow any valid HTTPS hostname (development only).
    carmen_allowed_host_regex: str = ""

    # Upload
    max_file_size_mb: int = 20

    # Database
    # Neon Postgres example:
    #   postgresql+asyncpg://user:pass@ep-xxx.aws.neon.tech/carmen_ai?ssl=require
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/carmen_ai"

    # Carmen API
    carmen_authorization: str = ""  # deprecated — kept for fallback only; prefer session token

    # Application version — bump on every release
    app_version: str = "1.0.0"

    # Auth — JWT + session encryption
    # Generate session_encryption_key: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    ocr_jwt_secret: str = "dev-ocr-jwt-secret-change-in-production"
    session_encryption_key: str = _WEAK_FERNET_KEY
    session_ttl_hours: float = 0.5

    # Admin Dashboard JWT — separate secret prevents token confusion attacks.
    # Leave empty to fall back to ocr_jwt_secret (dev only; set in production).
    # Generate: python -c "import secrets; print(secrets.token_hex(32))"
    admin_jwt_secret: str = ""
    admin_jwt_ttl_hours: int = 8

    # Admin bootstrap credentials — read by `python -m app.bootstrap_admin`.
    # Never leave these set in production after bootstrapping.
    admin_bootstrap_email: str = ""
    admin_bootstrap_password: str = ""

    # Ephemeral hosts (Render free / Heroku) — informational only since log retention
    # is now done by dropping PostgreSQL partitions (no on-disk archives).
    ephemeral_filesystem: bool = False

    # Multi-tenancy
    carmen_tenant_default: str = "dev"  # Fallback for localhost or missing Origin header

    # Sentry — leave empty to disable (set in production .env only)
    sentry_dsn: str = ""
    sentry_environment: str = "development"
    sentry_traces_sample_rate: float = 0.1  # 10% of requests traced (cost control)

    # Logging — set to true in production for ELK/Datadog/cloud log aggregation
    log_json: bool = False

    # Graceful shutdown — seconds to wait before cancelling background tasks
    shutdown_grace_seconds: int = 5

    class Config:
        env_file = Path(__file__).parent.parent / ".env"
        env_file_encoding = "utf-8"
        # Ignore stale .env entries from removed features (e.g. upload_dir / export_dir
        # from the pre-"no file storage" era) instead of crashing the app at startup.
        extra = "ignore"


settings = Settings()

# Normalize CORS allowed_origin_regex to strip accidentally pasted prefix
if settings.allowed_origin_regex:
    if settings.allowed_origin_regex.startswith("ALLOWED_ORIGIN_REGEX="):
        settings.allowed_origin_regex = settings.allowed_origin_regex[
            len("ALLOWED_ORIGIN_REGEX=") :
        ]
    settings.allowed_origin_regex = settings.allowed_origin_regex.strip("'\"")

# Validate regex compiles — a bad pattern crashes the entire app on first request.
if settings.allowed_origin_regex:
    try:
        re.compile(settings.allowed_origin_regex)
    except re.error as exc:
        _config_logger.error(
            "ALLOWED_ORIGIN_REGEX %r is invalid (%s); falling back to None (no regex matching).",
            settings.allowed_origin_regex,
            exc,
        )
        settings.allowed_origin_regex = None  # type: ignore[assignment]

# Reject known-weak secrets in production — skipped when app_debug=True (CI / local dev).
if not settings.app_debug and settings.ocr_jwt_secret in _WEAK_JWT_SECRETS:
    raise RuntimeError(
        "OCR_JWT_SECRET is set to a known-weak default. "
        "Set a strong random secret in your .env before starting."
    )

if not settings.app_debug and settings.session_encryption_key == _WEAK_FERNET_KEY:
    raise RuntimeError(
        "SESSION_ENCRYPTION_KEY is set to the placeholder value. "
        'Generate a real key: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
    )

# ── Production deployment guards (warn loudly when prod config looks unset) ─────
# These run only when app_debug=False (i.e. a real deployment). They do not crash
# the app — a pilot may legitimately run without a proxy/Sentry — but a misconfigured
# CORS surface is the kind of mistake that silently exposes the API, so we shout.
if not settings.app_debug:
    _origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
    _cors_unset = not settings.allowed_origin_regex and (
        not _origins or _origins == ["http://localhost:3010"]
    )
    if _cors_unset:
        _config_logger.critical(
            "CORS is not configured for production: ALLOWED_ORIGINS is still the localhost "
            "default and ALLOWED_ORIGIN_REGEX is empty. Set them to your real frontend origin(s) "
            "before exposing the API."
        )
    if "*" in _origins:
        _config_logger.critical(
            "ALLOWED_ORIGINS contains '*' — credentialed CORS is disabled and any origin is "
            "allowed. Set explicit origins for production."
        )
    if not settings.carmen_allowed_host_regex:
        _config_logger.warning(
            "CARMEN_ALLOWED_HOST_REGEX is empty — the Carmen proxy will accept any HTTPS host "
            "(SSRF risk). Restrict it to your known Carmen ERP hostname(s) before the pilot."
        )
    if not settings.sentry_dsn:
        _config_logger.warning(
            "SENTRY_DSN is empty — backend errors will not be reported to centralized error "
            "tracking. Set it for the pilot so issues are visible beyond ephemeral server logs."
        )
    if not settings.admin_jwt_secret:
        _config_logger.warning(
            "ADMIN_JWT_SECRET is empty — admin JWTs fall back to OCR_JWT_SECRET (shared signing "
            "key). Set a separate secret to prevent token-confusion between user and admin tokens."
        )

# ── Database URL normalization ────────────────────────────────────────────────
# Neon (and most managed Postgres providers) hand out URLs as `postgres://...`
# or `postgresql://...` — the libpq form. SQLAlchemy needs an explicit driver,
# and several libpq-only query params (sslmode, channel_binding) must be
# rewritten or stripped because asyncpg's connect() rejects unknown kwargs.


def _normalize_pg_url(url: str) -> str:
    from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

    if not url:
        return url
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://") :]

    parts = urlsplit(url)
    qs = parse_qsl(parts.query, keep_blank_values=True)
    cleaned: list[tuple[str, str]] = []
    for k, v in qs:
        kl = k.lower()
        if kl == "sslmode":
            # libpq: disable/allow/prefer/require/verify-ca/verify-full
            # asyncpg accepts: prefer/require/verify-ca/verify-full
            cleaned.append(("ssl", "require" if v in ("verify-ca", "verify-full") else v))
        elif kl == "channel_binding":
            # libpq-only auth tweak — asyncpg negotiates SCRAM channel binding
            # automatically when ssl=require, so we drop the param entirely.
            continue
        elif kl in {"ssl", "options", "application_name", "connect_timeout"}:
            cleaned.append((k, v))
        else:
            # Drop any other libpq-only param so asyncpg.connect() doesn't choke.
            continue

    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(cleaned), parts.fragment))


settings.database_url = _normalize_pg_url(settings.database_url)
