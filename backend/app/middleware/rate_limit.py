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
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app) -> None:
        super().__init__(app)
        # key: "{ip}:{group}" → deque of request timestamps
        self._windows: dict[str, deque[float]] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if any(path.startswith(p) for p in _SKIP_PREFIXES):
            return await call_next(request)

        group = _endpoint_group(path)
        max_req, window_sec = _LIMITS[group]
        key = f"{_client_ip(request)}:{group}"

        now = time.monotonic()
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
