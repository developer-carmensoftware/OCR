"""
Mapping router — thin HTTP layer for GL account/dept mapping.
Business logic lives in app/services/gl_suggestion_service.py
and app/services/mapping_history_service.py.
"""

import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import SessionInfo, get_current_session
from app.database import get_db
from app.models.schemas import (
    SuggestPaymentTypesRequest,
    SuggestRequest,
)
from app.services import gl_suggestion_service as map_gl
from app.services.accounting_config_service import get_accounting_config
from app.services.mapping_history_service import (
    BYPASS_THRESHOLD,
    get_confirmed_mappings,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/mapping", tags=["Mapping"])


async def _resolve_source(req_source: str | None, session: SessionInfo, db: AsyncSession) -> str:
    """Use the source sent by the frontend, else fall back to the tenant's
    saved accounting-config file_source."""
    if req_source:
        return req_source
    cfg = await get_accounting_config(db, session.tenant_id)
    return cfg.file_source or ""


_FIXED_FIELD_TYPES = ["Credit card commission", "Input Tax", "Bank Account"]


@router.post("/suggest")
async def suggest_mapping(
    req: SuggestRequest,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    source = await _resolve_source(req.source, session, db)
    history = await get_confirmed_mappings(
        req.bank_code, _FIXED_FIELD_TYPES, source, session.carmen_token
    )

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
    return {"suggestions": {**ai_suggestions, **bypass}, "source": "history" if bypass else "ai"}


@router.post("/suggest-payment-types")
async def suggest_payment_types(
    req: SuggestPaymentTypesRequest,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    source = await _resolve_source(req.source, session, db)
    history = await get_confirmed_mappings(
        req.bank_code, req.payment_types, source, session.carmen_token
    )

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
        logger.info("[suggest-payment-types] all bypassed via history (bank=%s)", req.bank_code)
        return {"suggestions": bypass, "source": "history"}

    result = await map_gl.suggest_payment_types(
        payment_types=remaining,
        accounts=[a.model_dump() for a in req.accounts],
        departments=[d.model_dump() for d in req.departments],
        hint_text="\n".join(hint_lines),
    )
    ai_suggestions = (result.output or {}).get("suggestions", {})
    return {"suggestions": {**ai_suggestions, **bypass}, "source": "history" if bypass else "ai"}
