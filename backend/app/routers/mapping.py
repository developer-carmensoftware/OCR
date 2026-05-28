"""
Mapping router — thin HTTP layer for GL account/dept mapping.
Business logic lives in app/services/gl_suggestion_service.py.
"""

import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import SessionInfo, get_current_session
from app.database import get_db
from app.models import MappingHistory
from app.services import gl_suggestion_service as map_gl
from app.services.mapping_history_service import BYPASS_THRESHOLD, get_confirmed_mappings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/mapping", tags=["Mapping"])


# ── Schemas ───────────────────────────────────────────────────────────────────


class CodeOption(BaseModel):
    code: str
    name: str
    type: str | None = None


class SuggestRequest(BaseModel):
    bank_code: str
    accounts: list[CodeOption]
    departments: list[CodeOption]


class FieldMapping(BaseModel):
    dept: str | None = None
    acc: str | None = None


class SuggestPaymentTypesRequest(BaseModel):
    bank_code: str
    payment_types: list[str]
    accounts: list[CodeOption]
    departments: list[CodeOption]


class SaveHistoryRequest(BaseModel):
    bank_code: str
    mappings: dict[str, FieldMapping]


# ── Endpoints ─────────────────────────────────────────────────────────────────


_FIXED_FIELD_TYPES = ["Credit card commission", "Input Tax", "Bank Account"]


@router.post("/suggest")
async def suggest_mapping(
    req: SuggestRequest,
    db: AsyncSession = Depends(get_db),
    _session: SessionInfo = Depends(get_current_session),
):
    history = await get_confirmed_mappings(db, req.bank_code, _FIXED_FIELD_TYPES)

    bypass: dict[str, dict] = {}
    hint_lines: list[str] = []
    for field in _FIXED_FIELD_TYPES:
        entry = history.get(field)
        if not entry:
            continue
        if entry["confirmed_count"] >= BYPASS_THRESHOLD:
            bypass[field] = {"dept": entry["dept"], "acc": entry["acc"]}
        else:
            dept_str = entry["dept"] or "?"
            hint_lines.append(
                f'  "{field}" → dept {dept_str}, acc {entry["acc"]}  (confirmed {entry["confirmed_count"]}×)'
            )

    remaining = [f for f in _FIXED_FIELD_TYPES if f not in bypass]
    if not remaining:
        logger.info("[suggest] all fields bypassed via history (bank=%s)", req.bank_code)
        return {"suggestions": bypass, "source": "history"}

    result = await map_gl.suggest_fixed_fields(
        accounts=[a.model_dump() for a in req.accounts],
        departments=[d.model_dump() for d in req.departments],
        hint_text="\n".join(hint_lines),
    )
    ai_suggestions = (result.output or {}).get("suggestions", {})
    merged = {**ai_suggestions, **bypass}
    return {"suggestions": merged, "source": "history" if bypass else "ai"}


@router.post("/suggest-payment-types")
async def suggest_payment_types(
    req: SuggestPaymentTypesRequest,
    db: AsyncSession = Depends(get_db),
    _session: SessionInfo = Depends(get_current_session),
):
    history = await get_confirmed_mappings(db, req.bank_code, req.payment_types)

    bypass: dict[str, dict] = {}
    hint_lines: list[str] = []
    for pt in req.payment_types:
        entry = history.get(pt)
        if not entry:
            continue
        if entry["confirmed_count"] >= BYPASS_THRESHOLD:
            bypass[pt] = {"dept": entry["dept"], "acc": entry["acc"]}
        else:
            dept_str = entry["dept"] or "?"
            hint_lines.append(
                f'  "{pt}" → dept {dept_str}, acc {entry["acc"]}  (confirmed {entry["confirmed_count"]}×)'
            )

    remaining = [pt for pt in req.payment_types if pt not in bypass]
    if not remaining:
        logger.info(
            "[suggest-payment-types] all types bypassed via history (bank=%s)", req.bank_code
        )
        return {"suggestions": bypass, "source": "history"}

    result = await map_gl.suggest_payment_types(
        payment_types=remaining,
        accounts=[a.model_dump() for a in req.accounts],
        departments=[d.model_dump() for d in req.departments],
        hint_text="\n".join(hint_lines),
    )
    ai_suggestions = (result.output or {}).get("suggestions", {})
    merged = {**ai_suggestions, **bypass}
    return {"suggestions": merged, "source": "history" if bypass else "ai"}


@router.get("/history")
async def get_mapping_history(
    bank_code: str,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    """Return saved mapping history for a given bank, scoped to current tenant."""
    result = await db.execute(
        select(MappingHistory)
        .where(
            MappingHistory.tenant_id == session.tenant_id,
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
