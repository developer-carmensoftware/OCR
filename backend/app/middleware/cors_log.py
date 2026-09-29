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
        # same-origin, which a browser never checks against CORS at all. Two ways to know:
        #   - Sec-Fetch-Site, the browser's own verdict. The one that matters in dev: the
        #     Vite proxy's shorthand config rewrites Host to this server's (changeOrigin),
        #     so Origin and Host disagree there while the browser still says same-origin.
        #     Every POST/PUT through it used to be reported as blocked while returning 200.
        #   - Origin's host equal to the request's own Host, for a client that sends no
        #     fetch metadata.
        same_origin = request.headers.get("sec-fetch-site") == "same-origin" or (
            bool(origin) and urlparse(origin).netloc == request.headers.get("host")
        )
        if origin and not same_origin and "access-control-allow-origin" not in response.headers:
            logger.warning(
                "CORS blocked for origin: %s | Method: %s | Path: %s | Status: %s",
                origin,
                request.method,
                request.url.path,
                response.status_code,
            )
        return response
