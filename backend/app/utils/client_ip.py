"""Resolve the real client IP, honoring the trust_proxy setting.

X-Forwarded-For is client-controllable, so trusting it lets an attacker spoof
their IP to bypass rate limits / admin lockout and poison audit logs. We only
read it when explicitly deployed behind a trusted reverse proxy.
"""

from starlette.requests import Request

from app.config import settings


def get_client_ip(request: Request) -> str | None:
    """Best-effort client IP. Uses X-Forwarded-For only when trust_proxy is on.

    X-Forwarded-For is appended to by each proxy, so the *right-most* entries are
    the ones added by our own trusted infrastructure and cannot be spoofed by the
    client. We therefore read `trusted_proxy_hops` entries from the right rather
    than the left-most entry (which a client can forge to evade rate limits).
    """
    if settings.trust_proxy:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            parts = [p.strip() for p in forwarded.split(",") if p.strip()]
            if parts:
                hops = max(1, settings.trusted_proxy_hops)
                idx = -min(hops, len(parts))
                return parts[idx]
    return request.client.host if request.client else None
