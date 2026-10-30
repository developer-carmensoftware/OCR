"""Admin maintenance endpoints — retention, summary rebuild, pricing."""

import logging
from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.admin_session import AdminPrincipal
from app.database import get_db
from app.models.schemas import ScheduleMaintenanceRequest, TenantMaintenanceRequest
from app.services.shared import maintenance as maintenance_service
from app.services.shared.pricing_cache import list_model_pricing

from .deps import require_maintenance_auth, require_permission

logger = logging.getLogger(__name__)
router = APIRouter()


def _assert_scope(admin: AdminPrincipal, tenant_id: str) -> None:
    """Scoped admins may only act on their own tenant."""
    if not admin.is_global and admin.tenant_scope != tenant_id:
        raise HTTPException(status_code=403, detail="Tenant out of scope")


@router.post("/summary/rebuild")
async def trigger_summary_rebuild(
    target_date: date | None = Query(None, alias="date"),
    _auth: AdminPrincipal | None = Depends(require_maintenance_auth),
):
    from app.services.admin.summary import build_daily_summary

    result = await build_daily_summary(target_date)
    return {"status": "completed", "date": str(target_date), "metrics": result}


@router.post("/summary/model-cost")
async def trigger_model_cost(
    target_date: date | None = Query(None, alias="date"),
    _auth: AdminPrincipal | None = Depends(require_maintenance_auth),
):
    from app.services.admin.summary import build_daily_model_cost

    result = await build_daily_model_cost(target_date)
    return {"status": "completed", "date": str(target_date), "metrics": result}


@router.post("/summary/monthly")
async def trigger_monthly_summary(
    target_date: date | None = Query(None, alias="date"),
    _auth: AdminPrincipal | None = Depends(require_maintenance_auth),
):
    from app.services.admin.summary import build_monthly_summary

    result = await build_monthly_summary(target_date)
    return {"status": "completed", "date": str(target_date), "metrics": result}


@router.post("/anomaly/run")
async def trigger_anomaly_detection(
    _auth: AdminPrincipal | None = Depends(require_maintenance_auth),
):
    from app.services.shared.anomaly import detect_anomalies

    result = await detect_anomalies()
    return {"status": "completed", "alerts_created": result}


@router.post("/pricing/sync")
async def trigger_pricing_sync(
    _auth: AdminPrincipal | None = Depends(require_maintenance_auth),
):
    from app.services.shared.pricing_cache import fetch_openrouter_pricing

    await fetch_openrouter_pricing()
    return {"status": "sync_started"}


@router.post("/encryption/backfill")
async def encrypt_plaintext_columns(
    dry_run: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _auth: AdminPrincipal | None = Depends(require_maintenance_auth),
):
    """Encrypt the values of encrypted columns still stored in plaintext — once per
    environment, after the deploy that encrypts new writes. `dry_run` counts without
    writing. See `services/shared/payload_encryption.py` for why this is a call and not a
    startup task."""
    from app.services.shared import payload_encryption

    found = await payload_encryption.encrypt_plaintext_columns(db, dry_run=dry_run)
    logger.info("Values in plaintext (dry_run=%s): %s", dry_run, found)
    return {"status": "dry_run" if dry_run else "completed", "plaintext_rows": found}


@router.post("/encryption/rotate")
async def rotate_encryption_key(
    dry_run: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _auth: AdminPrincipal | None = Depends(require_maintenance_auth),
):
    """Re-encrypt under `SESSION_ENCRYPTION_KEY` every token written under a key now listed
    in `SESSION_ENCRYPTION_KEYS_OLD` — step 3 of docs/KEY_ROTATION.md. `dry_run` counts.
    Repeat until every `stale` is 0, then drop the old key."""
    from app.services.shared import payload_encryption

    report = await payload_encryption.rotate_tokens(db, dry_run=dry_run)
    logger.info("Key rotation (dry_run=%s): %s", dry_run, report)
    return {"status": "dry_run" if dry_run else "completed", "columns": report}


@router.get("/pricing/list")
async def get_pricing_list(
    db: AsyncSession = Depends(get_db),
    _admin: AdminPrincipal = Depends(require_permission("configs", "read")),
):
    data = await list_model_pricing(db)
    return {"count": len(data), "data": data}


# ── Maintenance mode (global + per-tenant kill switch) ──────────────────────────


@router.get("/maintenance")
async def get_maintenance(
    db: AsyncSession = Depends(get_db),
    _admin: AdminPrincipal = Depends(require_permission("configs", "read")),
):
    return await maintenance_service.get_status(db)


@router.put("/maintenance/tenant/{tenant_id}")
async def set_tenant_maintenance(
    tenant_id: str,
    req: TenantMaintenanceRequest,
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("configs", "write")),
):
    _assert_scope(admin, tenant_id)
    await maintenance_service.set_tenant(db, tenant_id, req.enabled)
    return {"ok": True}


def _parse_iso(value: str, field: str) -> datetime:
    try:
        dt = datetime.fromisoformat(value)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"{field} is not a valid ISO8601 datetime")
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


@router.put("/maintenance/schedule")
async def schedule_maintenance(
    req: ScheduleMaintenanceRequest,
    db: AsyncSession = Depends(get_db),
    _admin: AdminPrincipal = Depends(require_permission("configs", "write")),
):
    start = _parse_iso(req.window_start, "window_start")
    end = _parse_iso(req.window_end, "window_end")
    if end <= start:
        raise HTTPException(status_code=400, detail="window_end must be after window_start")
    await maintenance_service.set_schedule(db, start, end, req.message)
    return {"ok": True}


@router.post("/maintenance/end")
async def end_maintenance(
    db: AsyncSession = Depends(get_db),
    _admin: AdminPrincipal = Depends(require_permission("configs", "write")),
):
    await maintenance_service.end_now(db)
    return {"ok": True}
