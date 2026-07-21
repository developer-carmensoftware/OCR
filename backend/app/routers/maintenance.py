"""Public maintenance-status probe — the frontend gate polls this to know when to
show/clear the "under maintenance" wall. No auth: reads the optional JWT for tenant
scope but works for anonymous callers too (returns the global flag)."""

from fastapi import APIRouter, Request

from app.middleware.performance import _decode_jwt_claims
from app.services import maintenance_service

router = APIRouter(prefix="/api/v1/maintenance", tags=["Maintenance"])


@router.get("/status")
async def maintenance_status(request: Request):
    tenant_id = _decode_jwt_claims(request).get("tid", "")
    active, message = await maintenance_service.is_maintenance(tenant_id or None)
    # Window bounds let the frontend render the advance-notice banner + countdown
    # and the "back by" line, without a second call. Not sensitive.
    window_start, window_end = maintenance_service.window_bounds_iso()
    return {
        "active": active,
        "message": message,
        "window_start": window_start,
        "window_end": window_end,
    }
