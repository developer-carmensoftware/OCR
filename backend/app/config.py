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

# Patterns that match (nearly) every origin — catastrophic when combined with
# credentialed CORS, so we refuse to start with one of these in production.
_WILDCARD_REGEX_PATTERNS = {".*", ".+", "^.*$", "^.+$", "(.*)", ".*?"}


def is_wildcard_origin_regex(pattern: str | None) -> bool:
    """True if the CORS origin regex effectively matches any origin."""
    if not pattern:
        return False
    return pattern.strip() in _WILDCARD_REGEX_PATTERNS


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env file."""

    # OpenRouter API
    openrouter_api_key: str = ""
    # Multi-key capacity pool — comma-separated list of OpenRouter keys. OpenRouter
    # rate-limits per key (separate bucket each), so spreading load across several keys
    # multiplies effective throughput. Empty → falls back to the single openrouter_api_key
    # (zero behaviour change for existing single-key deployments). See openrouter_api_keys_list.
    openrouter_api_keys: str = ""
    # Per-key concurrency caps — vision (OCR extract) and text (GL suggestion) get
    # SEPARATE semaphores so a burst of suggestions never starves OCR extractions.
    # NOTE: in-memory per-process. Under `uvicorn --workers N` the real in-flight cap per
    # key is N × these values — size them with worker count in mind to stay under the
    # provider's true per-key RPM. Defaults suit 1-2 workers (load-test sweet spot ≈ 4-6/key).
    llm_vision_concurrency_per_key: int = 6
    llm_text_concurrency_per_key: int = 6
    # Safety valve: max seconds a request waits for a free slot before the pool gives up
    # and raises LLMCapacityError (→ 429 + Retry-After). 0 = wait indefinitely (legacy
    # queue-and-wait behaviour, never returns 429 from the pool).
    llm_max_queue_wait_seconds: float = 10.0
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
    # Only enable when deployed behind a trusted reverse proxy (Render/nginx/Cloudflare).
    # When False, the spoofable XFF header is ignored and request.client.host is used.
    trust_proxy: bool = False
    # Number of trusted reverse-proxy hops in front of the app. With trust_proxy on,
    # the real client IP is read this many entries from the RIGHT of X-Forwarded-For
    # (the proxy-appended end), which is NOT client-spoofable. Render web services are a
    # single hop (=1); set to 2 if you also front the app with Cloudflare.
    trusted_proxy_hops: int = 1

    # Upload
    max_file_size_mb: int = 20

    # VAT rates the fee-invoice normalizer may encounter, comma-separated.
    # First entry = primary rate assumed when a rate cannot be inferred from the
    # document itself (e.g. only one amount was extracted). Thai standard is 7%
    # (statutory 10% reduced by an annually-renewed royal decree) — 0.10 is listed
    # so a decree lapse or a 10% document doesn't get misclassified. Zero-VAT /
    # exempt documents are detected structurally (grand == fee), not via this list.
    vat_rates: str = "0.07,0.10"

    # Database
    # Neon Postgres example:
    #   postgresql+asyncpg://user:pass@ep-xxx.aws.neon.tech/carmen_ai?ssl=require
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/carmen_ai"

    # Carmen API
    carmen_authorization: str = ""  # deprecated — kept for fallback only; prefer session token
    # SSRF allowlist for the client-supplied Carmen origin at /auth/exchange.
    # Comma-separated hostnames (no scheme), e.g. "carmen.example.com,erp.acme.co.th".
    # When set, only these hosts may be used as the Carmen origin. Leave empty only
    # in dev — production deployments should pin the known Carmen host(s).
    allowed_carmen_hosts: str = ""

    # ── Carmen AR posting (admin order-review) — SECRETS, never in system_configs ──
    # Seller's own Carmen ERP endpoint for posting paid orders as AR entries.
    # Admin context has no per-session Carmen token, so a service credential is used.
    # carmen_ar_url = full endpoint, e.g. https://erp.example.com/Carmen.API/api/interfacePostAR/CarmenAI
    # Leave empty to disable AR posting (post-ar returns a clear "not configured" error).
    carmen_ar_url: str = ""
    carmen_ar_token: str = ""  # value for the Authorization header

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

    # Internal job token — presented by pg_net cron jobs as Bearer in Authorization.
    # Must match the vault.secrets value 'internal_job_token' set in Supabase Vault.
    # Generate: python -c "import secrets; print(secrets.token_hex(32))"
    # NEVER put the real value in system_configs DB table — secrets in .env only.
    internal_job_token: str = ""

    # ── Supabase Storage (slip upload) — SECRETS, never put in system_configs ──
    # Required for slip upload/download. Leave empty to disable slip storage (dev).
    supabase_url: str = ""
    supabase_service_key: str = ""  # service_role key (bypasses RLS)
    slip_bucket: str = "payment-slips"

    @property
    def vat_rates_list(self) -> list[float]:
        """Supported VAT rates (0 < r < 1), first = primary. Falls back to [0.07]."""
        out: list[float] = []
        for tok in self.vat_rates.split(","):
            tok = tok.strip()
            try:
                r = float(tok)
            except ValueError:
                continue
            if 0 < r < 1:
                out.append(r)
        return out or [0.07]

    @property
    def allowed_carmen_hosts_list(self) -> list[str]:
        """Lowercased Carmen host allowlist (empty list = not configured)."""
        return [h.strip().lower() for h in self.allowed_carmen_hosts.split(",") if h.strip()]

    @property
    def openrouter_api_keys_list(self) -> list[str]:
        """Resolved list of OpenRouter API keys for the capacity pool.

        Prefers the comma-separated `openrouter_api_keys`; falls back to the single
        `openrouter_api_key`. De-duplicates while preserving order and drops blanks.
        Always returns at least one entry (possibly an empty string if nothing is set,
        so the pool still constructs and surfaces auth errors at call time, not import).
        """
        raw = (
            [k.strip() for k in self.openrouter_api_keys.split(",")]
            if self.openrouter_api_keys
            else []
        )
        keys = [k for k in raw if k]
        if not keys and self.openrouter_api_key:
            # Also parse comma-separated values from the singular key field so that
            # OPENROUTER_API_KEY=key1,key2 works without setting OPENROUTER_API_KEYS.
            keys = [k.strip() for k in self.openrouter_api_key.split(",") if k.strip()]
        # De-dup, preserve order.
        seen: set[str] = set()
        deduped = [k for k in keys if not (k in seen or seen.add(k))]
        return deduped or [self.openrouter_api_key]

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
    # HARD FAIL: a wildcard origin regex effectively allows any site to call the API.
    # This is the single most dangerous CORS mistake, so refuse to start rather than
    # silently expose every endpoint to cross-origin reads.
    if is_wildcard_origin_regex(settings.allowed_origin_regex):
        raise RuntimeError(
            f"ALLOWED_ORIGIN_REGEX={settings.allowed_origin_regex!r} matches any origin — "
            "refusing to start in production. Set ALLOWED_ORIGINS to your exact frontend "
            "origin(s), or a tightly-scoped regex (e.g. ^https://app\\.example\\.com$)."
        )
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
    if not settings.sentry_dsn:
        _config_logger.warning(
            "SENTRY_DSN is empty — backend errors will not be reported to centralized error "
            "tracking. Set it for the pilot so issues are visible beyond ephemeral server logs."
        )
    if not settings.allowed_carmen_hosts_list:
        # Intentionally empty in many deployments: tenants self-host Carmen on
        # arbitrary domains with no common pattern, so a host allowlist isn't
        # practical. SSRF is still contained by _validate_uri's DNS resolution +
        # internal-IP block (private/loopback/link-local/metadata all rejected).
        # Residual is blind SSRF to public hosts only (no response body returned).
        _config_logger.warning(
            "ALLOWED_CARMEN_HOSTS is empty — /auth/exchange accepts any *public* Carmen host; "
            "internal/private targets are still blocked by the DNS-resolution check."
        )
    # HARD FAIL: admin tokens must not share a signing key with user tokens, otherwise
    # a leak of OCR_JWT_SECRET would also let an attacker forge admin JWTs.
    if not settings.admin_jwt_secret:
        raise RuntimeError(
            "ADMIN_JWT_SECRET is empty in production — admin JWTs would fall back to "
            "OCR_JWT_SECRET (shared signing key). Set a separate strong secret."
        )
    if settings.admin_jwt_secret == settings.ocr_jwt_secret:
        raise RuntimeError(
            "ADMIN_JWT_SECRET must differ from OCR_JWT_SECRET to prevent token confusion "
            "between user and admin tokens."
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
