"""Resolve the real client IP, honoring the trust_proxy setting.

X-Forwarded-For is client-controllable, so trusting it lets an attacker spoof
their IP to bypass rate limits / admin lockout and poison audit logs. We only
read it when explicitly deployed behind a trusted reverse proxy.
"""

from starlette.requests import Request

from app.config import settings


def get_client_ip(request: Request) -> str | None:
    """Best-effort client IP. Uses X-Forwarded-For only when trust_proxy is on."""
    if settings.trust_proxy:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            # Left-most entry is the original client when set by a trusted proxy.
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None
