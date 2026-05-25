"""Admin maintenance endpoints — quotas, retention, summary rebuild, pricing."""

import logging
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.billing import LLMModelPricing

from .deps import require_admin

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/retention/run")
async def trigger_retention(
    _admin: None = Depends(require_admin),
):
    from app.services.retention_service import purge_inactive_sessions

    purged_sessions = await purge_inactive_sessions()
    return {"status": "completed", "purged_sessions": purged_sessions}


@router.post("/summary/rebuild")
async def trigger_summary_rebuild(
    target_date: date | None = Query(None, alias="date"),
    _admin: None = Depends(require_admin),
):
    from app.services.summary_service import build_daily_summary

    result = await build_daily_summary(target_date)
    return {"status": "completed", "date": str(target_date), "metrics": result}


@router.post("/summary/model-cost")
async def trigger_model_cost(
    target_date: date | None = Query(None, alias="date"),
    _admin: None = Depends(require_admin),
):
    from app.services.summary_service import build_daily_model_cost

    result = await build_daily_model_cost(target_date)
    return {"status": "completed", "date": str(target_date), "metrics": result}


@router.post("/summary/monthly")
async def trigger_monthly_summary(
    target_date: date | None = Query(None, alias="date"),
    _admin: None = Depends(require_admin),
):
    from app.services.summary_service import build_monthly_summary

    result = await build_monthly_summary(target_date)
    return {"status": "completed", "date": str(target_date), "metrics": result}


@router.post("/anomaly/run")
async def trigger_anomaly_detection(
    _admin: None = Depends(require_admin),
):
    from app.services.anomaly_service import detect_anomalies

    result = await detect_anomalies()
    return {"status": "completed", "alerts_created": result}


@router.post("/pricing/sync")
async def trigger_pricing_sync(
    _admin: None = Depends(require_admin),
):
    from app.services.usage_service import fetch_openrouter_pricing

    await fetch_openrouter_pricing()
    return {"status": "sync_started"}


@router.get("/pricing/list")
async def get_pricing_list(
    db: AsyncSession = Depends(get_db),
    _admin: None = Depends(require_admin),
):
    result = await db.execute(select(LLMModelPricing).order_by(LLMModelPricing.model_name))
    rows = result.scalars().all()
    return {
        "count": len(rows),
        "data": [
            {
                "model_name": r.model_name,
                "input_price_per_1m": float(str(r.input_price_per_1m)),
                "output_price_per_1m": float(str(r.output_price_per_1m)),
                "source": r.source,
                "price_verified_at": r.price_verified_at.isoformat()
                if r.price_verified_at
                else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in rows
        ],
    }
