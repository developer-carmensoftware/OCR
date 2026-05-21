"""
Application configuration — loads settings from .env file.
"""

import os
from pathlib import Path

from pydantic_settings import BaseSettings

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
    allowed_origin_regex: str = r"https://[a-zA-Z0-9\-]+\.carmen4\.com"
    allowed_origins: str = "http://localhost:3010"

    # SSRF protection — comma-separated regex patterns for allowed Carmen hostnames.
    # Example: "erp\.company\.com,erp2\.company\.com"
    # Leave empty to allow any valid HTTPS hostname (development only).
    carmen_allowed_host_regex: str = ""

    # Upload
    max_file_size_mb: int = 20

    # Database
    database_url: str = "mysql+aiomysql://root:@localhost:3306/carmen_ai"

    # Carmen API
    carmen_authorization: str = ""  # deprecated — kept for fallback only; prefer session token

    # Application version — bump on every release
    app_version: str = "1.0.0"

    # Auth — JWT + session encryption
    # Generate session_encryption_key: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    ocr_jwt_secret: str = "dev-ocr-jwt-secret-change-in-production"
    session_encryption_key: str = _WEAK_FERNET_KEY
    session_ttl_hours: int = 8

    # Data retention & archival
    archive_dir: str = "./archives"
    retention_enabled: bool = True

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

# Resolve relative paths to absolute, anchored to the backend directory.
# This ensures the correct location regardless of the process working directory.
_BACKEND_DIR = Path(__file__).parent.parent


def _abs(path: str) -> str:
    p = Path(path)
    return str(p if p.is_absolute() else _BACKEND_DIR / p)


settings.archive_dir = _abs(settings.archive_dir)

# Ensure upload/export/archive directories exist
os.makedirs(settings.archive_dir, exist_ok=True)
