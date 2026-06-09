"""
HTTP-level rate limiting middleware — sliding window per IP per endpoint group.

Groups and limits (per 60 seconds):
  auth     — 20 req  (brute-force protection)
  extract  — 30 req  (expensive LLM calls)
  default  — 120 req (general API)

This is a first line of defence against flooding / runaway clients.
Business-level quotas (max OCR calls per period) are enforced separately
by check_quota() in each router.

Note: in-memory store — limits reset on process restart and are not shared
across multiple worker processes. For multi-process deployments, replace
_windows with a Redis-backed store.
"""

import time
from collections import defaultdict, deque

from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.utils.client_ip import get_client_ip

# (max_requests, window_seconds)
_LIMITS: dict[str, tuple[int, int]] = {
    "auth": (20, 60),
    "extract": (30, 60),
    "default": (120, 60),
}

# Skip rate limiting for non-API paths
_SKIP_PREFIXES = ("/docs", "/redoc", "/openapi.json", "/livez", "/readyz")


def _endpoint_group(path: str) -> str:
    if "/auth/" in path:
        return "auth"
    if path.endswith("/extract") or path.endswith("/suggest"):
        return "extract"
    return "default"


def _client_ip(request: Request) -> str:
    return get_client_ip(request) or "unknown"


# Periodically sweep dead keys (IPs that haven't been seen in a while) so the
# dict doesn't grow unbounded across months of operation.
_SWEEP_INTERVAL_SECONDS = 300.0  # every 5 minutes
_KEY_TTL_SECONDS = 3600.0  # drop keys whose last request was >1h ago


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app) -> None:
        super().__init__(app)
        # key: "{ip}:{group}" → deque of request timestamps
        self._windows: dict[str, deque[float]] = defaultdict(deque)
        self._last_sweep: float = time.monotonic()

    def _maybe_sweep(self, now: float) -> None:
        """Drop keys with empty or stale windows. O(n) over the dict — runs rarely."""
        if now - self._last_sweep < _SWEEP_INTERVAL_SECONDS:
            return
        self._last_sweep = now
        cutoff = now - _KEY_TTL_SECONDS
        dead = [k for k, w in self._windows.items() if not w or w[-1] < cutoff]
        for k in dead:
            del self._windows[k]

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if any(path.startswith(p) for p in _SKIP_PREFIXES):
            return await call_next(request)

        group = _endpoint_group(path)
        max_req, window_sec = _LIMITS[group]
        key = f"{_client_ip(request)}:{group}"

        now = time.monotonic()
        self._maybe_sweep(now)

        window = self._windows[key]

        cutoff = now - window_sec
        while window and window[0] < cutoff:
            window.popleft()

        if len(window) >= max_req:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests — please slow down."},
                headers={"Retry-After": str(window_sec)},
            )

        window.append(now)
        return await call_next(request)
