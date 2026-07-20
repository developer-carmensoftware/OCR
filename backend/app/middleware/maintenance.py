"""Blocks non-admin traffic with 503 when maintenance mode is on (global or per-tenant)."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.middleware.performance import _decode_jwt_claims
from app.services import maintenance_service

# Always reachable, even during maintenance: health (Render restarts the service
# if this ever 503s), the admin plane (so admins can toggle it back off), the public
# status probe the frontend polls, and API docs.
_ALLOW_PREFIXES = (
    "/api/v1/health",
    "/api/v1/admin",
    "/api/v1/maintenance/status",
    "/api/version",
    "/docs",
    "/openapi.json",
    "/redoc",
)


class MaintenanceMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path.startswith(_ALLOW_PREFIXES):
            return await call_next(request)

        tenant_id = _decode_jwt_claims(request).get("tid", "")
        active, message = await maintenance_service.is_maintenance(tenant_id or None)
        if active:
            return JSONResponse(
                status_code=503,
                content={"detail": message or "Service under maintenance", "code": "maintenance"},
                headers={"Retry-After": "600", "X-Maintenance": "1"},
            )
        return await call_next(request)
