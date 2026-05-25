import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger(__name__)


class CORSLogMiddleware(BaseHTTPMiddleware):
    """Logs requests blocked by CORS for better debuggability in production."""

    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin")
        response = await call_next(request)

        # If the request had an Origin header, but the response does not have Access-Control-Allow-Origin,
        # it means CORS was blocked/rejected by the CORS middleware.
        if origin and "access-control-allow-origin" not in response.headers:
            logger.warning(
                "CORS blocked for origin: %s | Method: %s | Path: %s | Status: %s",
                origin,
                request.method,
                request.url.path,
                response.status_code,
            )
        return response
