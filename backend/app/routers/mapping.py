"""
Mapping router — thin HTTP layer for GL account/dept mapping.

Business logic lives in app/tools/map_gl.py.
"""

import logging
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import MappingHistory
from app.tools import map_gl
from app.auth import get_current_session, SessionInfo
from app.context import current_bu

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/mapping", tags=["Mapping"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class CodeOption(BaseModel):
    code: str
    name: str
    type: Optional[str] = None


class SuggestRequest(BaseModel):
    accounts: List[CodeOption]
    departments: List[CodeOption]


class FieldMapping(BaseModel):
    dept: Optional[str] = None
    acc: Optional[str] = None


class SuggestPaymentTypesRequest(BaseModel):
    payment_types: List[str]
    accounts: List[CodeOption]
    departments: List[CodeOption]


class SaveHistoryRequest(BaseModel):
    bank_name: str
    mappings: Dict[str, FieldMapping]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/suggest")
async def suggest_mapping(
    req: SuggestRequest,
    _session: SessionInfo = Depends(get_current_session),
):
    """Suggest dept/acc codes for Credit card commission, Input Tax, Bank Account via LLM."""
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
    """Suggest dept/acc codes for dynamic payment types (Visa, MCA, QR, …) via LLM."""
    result = await map_gl.suggest_payment_types(
        payment_types=req.payment_types,
        accounts=[a.model_dump() for a in req.accounts],
        departments=[d.model_dump() for d in req.departments],
    )
    return result.output or {"suggestions": {}, "source": "ai"}


@router.get("/history")
async def get_mapping_history(
    bank_name: str,
    db: AsyncSession = Depends(get_db),
    _session: SessionInfo = Depends(get_current_session),
):
    """Return all saved mapping history rows for a given bank."""
    bu = current_bu.get() or None
    result = await db.execute(
        select(MappingHistory)
        .where(
            MappingHistory.bank_name == bank_name,
            MappingHistory.bu == bu,
        )
        .order_by(MappingHistory.confirmed_count.desc(), MappingHistory.updated_at.desc())
    )
    rows = result.scalars().all()

    history: Dict[str, dict] = {}
    for row in rows:
        if row.field_type not in history:
            history[row.field_type] = {
                "dept": row.dept_code,
                "acc": row.acc_code,
                "confirmed_count": row.confirmed_count,
            }
    return {"bank_name": bank_name, "history": history}


@router.post("/history/save")
async def save_mapping_history(
    req: SaveHistoryRequest,
    db: AsyncSession = Depends(get_db),
    _session: SessionInfo = Depends(get_current_session),
):
    """Upsert confirmed mappings into history (INSERT or UPDATE confirmed_count)."""
    saved = 0
    for field_type, mapping in req.mappings.items():
        if not mapping.dept and not mapping.acc:
            continue

        bu = current_bu.get() or None
        result = await db.execute(
            select(MappingHistory).where(
                MappingHistory.bu == bu,
                MappingHistory.bank_name == req.bank_name,
                MappingHistory.field_type == field_type,
                MappingHistory.dept_code == mapping.dept,
                MappingHistory.acc_code == mapping.acc,
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.dept_code = mapping.dept
            existing.acc_code = mapping.acc
            existing.confirmed_count = (existing.confirmed_count or 0) + 1
            await db.execute(
                text("UPDATE mapping_history SET updated_at = CURRENT_TIMESTAMP WHERE id = :id"),
                {"id": existing.id},
            )
        else:
            db.add(MappingHistory(
                bu=bu,
                bank_name=req.bank_name,
                field_type=field_type,
                dept_code=mapping.dept,
                acc_code=mapping.acc,
                confirmed_count=1,
            ))
        saved += 1

    await db.commit()
    logger.info(f"Saved {saved} mapping history rows for bank={req.bank_name}")
    return {"ok": True, "saved": saved}
