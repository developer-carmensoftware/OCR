"""Admin Router — usage summary queries + manual trigger endpoints."""

import logging
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_session, SessionInfo
from app.config import settings
from app.database import get_db
from app.models.orm import DailyUsageSummary

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])


def require_admin(x_admin_key: str = Header(..., alias="X-Admin-Key")) -> None:
    """Require a valid master API key for all admin endpoints."""
    if not settings.master_api_key:
        raise HTTPException(status_code=503, detail="Admin access not configured")
    if x_admin_key != settings.master_api_key:
        raise HTTPException(status_code=403, detail="Invalid admin key")


@router.get("/usage-summary")
async def get_usage_summary(
    from_date: Optional[date] = Query(None, alias="from"),
    to_date:   Optional[date] = Query(None, alias="to"),
    module_id: Optional[str]  = Query(None, description="Filter by module id"),
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
    _admin: None = Depends(require_admin),
):
    if not from_date:
        from_date = date.today().replace(day=1)
    if not to_date:
        to_date = date.today()

    query = (
        select(DailyUsageSummary)
        .where(
            DailyUsageSummary.tenant_id == session.tenant_id,
            DailyUsageSummary.business_unit_id == session.business_unit_id,
            DailyUsageSummary.summary_date >= from_date,
            DailyUsageSummary.summary_date <= to_date,
        )
        .order_by(DailyUsageSummary.summary_date.desc())
    )
    if module_id:
        query = query.where(DailyUsageSummary.module_id == module_id)

    result = await db.execute(query)
    rows   = result.scalars().all()

    return {
        "tenant_id":        session.tenant_id,
        "business_unit_id": session.business_unit_id,
        "from":  str(from_date),
        "to":    str(to_date),
        "days":  len(rows),
        "data": [
            {
                "date":               str(r.summary_date.date() if isinstance(r.summary_date, datetime) else r.summary_date),
                "module_id":          r.module_id,
                "documents":          r.total_documents,
                "submissions":        r.total_submissions,
                "llm_calls":          r.total_llm_calls,
                "tokens":             r.total_tokens,
                "cost_usd":           float(r.total_cost_usd or 0),
                "avg_llm_latency_ms": r.avg_llm_latency_ms,
                "api_calls":          r.total_api_calls,
                "avg_api_latency_ms": r.avg_api_latency_ms,
                "p95_api_latency_ms": r.p95_api_latency_ms,
                "errors":             r.total_errors,
                "corrections":        r.total_corrections,
                "outbound_calls":     r.total_outbound_calls,
            }
            for r in rows
        ],
    }


@router.get("/usage-summary/totals")
async def get_usage_totals(
    from_date: Optional[date] = Query(None, alias="from"),
    to_date:   Optional[date] = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
    _admin: None = Depends(require_admin),
):
    if not from_date:
        from_date = date.today().replace(day=1)
    if not to_date:
        to_date = date.today()

    result = await db.execute(
        select(
            func.sum(DailyUsageSummary.total_documents).label("total_documents"),
            func.sum(DailyUsageSummary.total_submissions).label("total_submissions"),
            func.sum(DailyUsageSummary.total_llm_calls).label("total_llm_calls"),
            func.sum(DailyUsageSummary.total_tokens).label("total_tokens"),
            func.sum(DailyUsageSummary.total_cost_usd).label("total_cost_usd"),
            func.avg(DailyUsageSummary.avg_llm_latency_ms).label("avg_llm_latency_ms"),
            func.sum(DailyUsageSummary.total_api_calls).label("total_api_calls"),
            func.avg(DailyUsageSummary.avg_api_latency_ms).label("avg_api_latency_ms"),
            func.sum(DailyUsageSummary.total_errors).label("total_errors"),
            func.sum(DailyUsageSummary.total_corrections).label("total_corrections"),
            func.sum(DailyUsageSummary.total_outbound_calls).label("total_outbound_calls"),
        )
        .where(
            DailyUsageSummary.tenant_id == session.tenant_id,
            DailyUsageSummary.business_unit_id == session.business_unit_id,
            DailyUsageSummary.summary_date >= from_date,
            DailyUsageSummary.summary_date <= to_date,
        )
    )
    row = result.mappings().fetchone()

    return {
        "tenant_id":        session.tenant_id,
        "business_unit_id": session.business_unit_id,
        "from":   str(from_date),
        "to":     str(to_date),
        "totals": {
            "documents":          int(row["total_documents"] or 0),
            "submissions":        int(row["total_submissions"] or 0),
            "llm_calls":          int(row["total_llm_calls"] or 0),
            "tokens":             int(row["total_tokens"] or 0),
            "cost_usd":           float(row["total_cost_usd"] or 0),
            "avg_llm_latency_ms": round(float(row["avg_llm_latency_ms"] or 0), 2),
            "api_calls":          int(row["total_api_calls"] or 0),
            "avg_api_latency_ms": round(float(row["avg_api_latency_ms"] or 0), 2),
            "errors":             int(row["total_errors"] or 0),
            "corrections":        int(row["total_corrections"] or 0),
            "outbound_calls":     int(row["total_outbound_calls"] or 0),
        },
    }


@router.post("/retention/run")
async def trigger_retention(
    _session: SessionInfo = Depends(get_current_session),
    _admin: None = Depends(require_admin),
):
    from app.services.retention_service import archive_and_cleanup, purge_inactive_sessions
    result = await archive_and_cleanup()
    await purge_inactive_sessions()
    return {"status": "completed", "summary": result}


@router.post("/summary/rebuild")
async def trigger_summary_rebuild(
    target_date: Optional[date] = Query(None, alias="date"),
    _session: SessionInfo = Depends(get_current_session),
    _admin: None = Depends(require_admin),
):
    from app.services.summary_service import build_daily_summary
    result = await build_daily_summary(target_date)
    return {"status": "completed", "date": str(target_date), "metrics": result}


@router.post("/pricing/sync")
async def trigger_pricing_sync(
    _session: SessionInfo = Depends(get_current_session),
    _admin: None = Depends(require_admin),
):
    from app.services.usage_service import fetch_openrouter_pricing
    await fetch_openrouter_pricing()
    return {"status": "sync_started"}


@router.get("/pricing/list")
async def get_pricing_list(
    db: AsyncSession = Depends(get_db),
    _session: SessionInfo = Depends(get_current_session),
    _admin: None = Depends(require_admin),
):
    from app.models.orm import LLMModelPricing
    result = await db.execute(select(LLMModelPricing).order_by(LLMModelPricing.model_name))
    rows   = result.scalars().all()
    return {
        "count": len(rows),
        "data": [
            {
                "model_name":          r.model_name,
                "input_price_per_1m":  float(r.input_price_per_1m),
                "output_price_per_1m": float(r.output_price_per_1m),
                "source":              r.source,
                "price_verified_at":   r.price_verified_at.isoformat() if r.price_verified_at else None,
                "updated_at":          r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in rows
        ],
    }
