"""
Mapping router — thin HTTP layer for GL account/dept mapping.
Business logic lives in app/tools/map_gl.py.
"""

import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import SessionInfo, get_current_session
from app.database import get_db
from app.models import MappingHistory
from app.tools import map_gl

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/mapping", tags=["Mapping"])


# ── Schemas ───────────────────────────────────────────────────────────────────


class CodeOption(BaseModel):
    code: str
    name: str
    type: str | None = None


class SuggestRequest(BaseModel):
    accounts: list[CodeOption]
    departments: list[CodeOption]


class FieldMapping(BaseModel):
    dept: str | None = None
    acc: str | None = None


class SuggestPaymentTypesRequest(BaseModel):
    payment_types: list[str]
    accounts: list[CodeOption]
    departments: list[CodeOption]


class SaveHistoryRequest(BaseModel):
    bank_code: str
    mappings: dict[str, FieldMapping]


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/suggest")
async def suggest_mapping(
    req: SuggestRequest,
    _session: SessionInfo = Depends(get_current_session),
):
    result = await map_gl.suggest_fixed_fields(
        accounts=[a.model_dump() for a in req.accounts],
        departments=[d.model_dump() for d in req.departments],
    )
    return result.output or {"suggestions": {}, "source": "ai"}


@router.post("/suggest-payment-types")
async def suggest_payment_types(
    req: SuggestPaymentTypesRequest,
    _session: SessionInfo = Depends(get_current_session),
):
    result = await map_gl.suggest_payment_types(
        payment_types=req.payment_types,
        accounts=[a.model_dump() for a in req.accounts],
        departments=[d.model_dump() for d in req.departments],
    )
    return result.output or {"suggestions": {}, "source": "ai"}


@router.get("/history")
async def get_mapping_history(
    bank_code: str,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    """Return saved mapping history for a given bank, scoped to current BU."""
    result = await db.execute(
        select(MappingHistory)
        .where(
            MappingHistory.tenant_id == session.tenant_id,
            MappingHistory.business_unit_id == session.business_unit_id,
            MappingHistory.bank_code == bank_code,
            MappingHistory.deleted_at.is_(None),
        )
        .order_by(MappingHistory.confirmed_count.desc(), MappingHistory.updated_at.desc())
    )
    rows = result.scalars().all()

    history: dict[str, dict] = {}
    for row in rows:
        if row.field_type not in history:
            history[str(row.field_type)] = {
                "dept": row.dept_code,
                "acc": row.acc_code,
                "confirmed_count": row.confirmed_count,
            }
    return {"bank_code": bank_code, "history": history}


@router.post("/history/save")
async def save_mapping_history(
    req: SaveHistoryRequest,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    """Upsert confirmed GL mappings into history."""
    saved = 0
    for field_type, mapping in req.mappings.items():
        if not mapping.dept and not mapping.acc:
            continue

        existing_result = await db.execute(
            select(MappingHistory).where(
                MappingHistory.tenant_id == session.tenant_id,
                MappingHistory.business_unit_id == session.business_unit_id,
                MappingHistory.bank_code == req.bank_code,
                MappingHistory.field_type == field_type,
                MappingHistory.dept_code == mapping.dept,
                MappingHistory.acc_code == mapping.acc,
                MappingHistory.deleted_at.is_(None),
            )
        )
        existing = existing_result.scalar_one_or_none()

        if existing:
            existing.confirmed_count = (existing.confirmed_count or 0) + 1  # type: ignore[assignment]
        else:
            db.add(
                MappingHistory(
                    tenant_id=session.tenant_id,
                    business_unit_id=session.business_unit_id,
                    bank_code=req.bank_code,
                    field_type=field_type,
                    dept_code=mapping.dept,
                    acc_code=mapping.acc,
                    confirmed_count=1,
                )
            )
        saved += 1

    await db.commit()
    logger.info("Saved %d mapping row(s) for bank=%s", saved, req.bank_code)
    return {"ok": True, "saved": saved}
