import logging
from urllib.parse import urlparse

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger(__name__)


class CORSLogMiddleware(BaseHTTPMiddleware):
    """Logs requests blocked by CORS for better debuggability in production."""

    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin")
        response = await call_next(request)

        # If the request had an Origin header, but the response does not have Access-Control-Allow-Origin,
        # it means CORS was blocked/rejected by the CORS middleware — unless the request is
        # same-origin, which a browser never checks against CORS at all. The Vite dev proxy
        # is exactly that: it forwards the browser's own Host, so every same-origin POST/PUT
        # through it used to be reported as blocked while it returned 200.
        same_origin = bool(origin) and urlparse(origin).netloc == request.headers.get("host")
        if origin and not same_origin and "access-control-allow-origin" not in response.headers:
            logger.warning(
                "CORS blocked for origin: %s | Method: %s | Path: %s | Status: %s",
                origin,
                request.method,
                request.url.path,
                response.status_code,
            )
        return response
