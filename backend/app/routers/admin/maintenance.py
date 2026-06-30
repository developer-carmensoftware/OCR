"""Admin maintenance endpoints — retention, summary rebuild, pricing."""

import logging
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.admin_session import AdminPrincipal
from app.database import get_db
from app.services.usage_service import list_model_pricing

from .deps import require_maintenance_auth, require_permission

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/retention/run")
async def trigger_retention(
    _auth: AdminPrincipal | None = Depends(require_maintenance_auth),
):
    from app.services.retention_service import purge_inactive_sessions

    purged_sessions = await purge_inactive_sessions()
    return {"status": "completed", "purged_sessions": purged_sessions}


@router.post("/summary/rebuild")
async def trigger_summary_rebuild(
    target_date: date | None = Query(None, alias="date"),
    _auth: AdminPrincipal | None = Depends(require_maintenance_auth),
):
    from app.services.summary_service import build_daily_summary

    result = await build_daily_summary(target_date)
    return {"status": "completed", "date": str(target_date), "metrics": result}


@router.post("/summary/model-cost")
async def trigger_model_cost(
    target_date: date | None = Query(None, alias="date"),
    _auth: AdminPrincipal | None = Depends(require_maintenance_auth),
):
    from app.services.summary_service import build_daily_model_cost

    result = await build_daily_model_cost(target_date)
    return {"status": "completed", "date": str(target_date), "metrics": result}


@router.post("/summary/monthly")
async def trigger_monthly_summary(
    target_date: date | None = Query(None, alias="date"),
    _auth: AdminPrincipal | None = Depends(require_maintenance_auth),
):
    from app.services.summary_service import build_monthly_summary

    result = await build_monthly_summary(target_date)
    return {"status": "completed", "date": str(target_date), "metrics": result}


@router.post("/anomaly/run")
async def trigger_anomaly_detection(
    _auth: AdminPrincipal | None = Depends(require_maintenance_auth),
):
    from app.services.anomaly_service import detect_anomalies

    result = await detect_anomalies()
    return {"status": "completed", "alerts_created": result}


@router.post("/pricing/sync")
async def trigger_pricing_sync(
    _auth: AdminPrincipal | None = Depends(require_maintenance_auth),
):
    from app.services.usage_service import fetch_openrouter_pricing

    await fetch_openrouter_pricing()
    return {"status": "sync_started"}


@router.get("/pricing/list")
async def get_pricing_list(
    db: AsyncSession = Depends(get_db),
    _admin: AdminPrincipal = Depends(require_permission("configs", "read")),
):
    data = await list_model_pricing(db)
    return {"count": len(data), "data": data}
