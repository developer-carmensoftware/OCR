"""
Mapping History Service — abstract source for confirmed GL mappings (credit card).

Current source: local mapping_history table (DB).
Future swap: when Carmen exposes a mapping history API, replace _fetch_from_local_db()
with a Carmen call — nothing outside this file needs to change.
"""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.context import current_tenant_id
from app.models.orm import MappingHistory

logger = logging.getLogger(__name__)

BYPASS_THRESHOLD = 3  # confirmed >= N times → skip LLM entirely


async def get_confirmed_mappings(
    db: AsyncSession,
    bank_code: str,
    field_types: list[str],
    carmen_token: str = "",  # reserved for future Carmen API swap
) -> dict[str, dict]:
    """Return best confirmed mapping per field_type for this tenant + bank.

    Output: {field_type: {dept, acc, confirmed_count}}

    When Carmen provides a mapping history endpoint, add:
        if carmen_token:
            return await _fetch_from_carmen(bank_code, field_types, carmen_token)
    above the DB call — router/prompt callers need no changes.
    """
    return await _fetch_from_local_db(db, bank_code, field_types)


async def _fetch_from_local_db(
    db: AsyncSession,
    bank_code: str,
    field_types: list[str],
) -> dict[str, dict]:
    tenant_id = current_tenant_id.get() or ""
    result = await db.execute(
        select(MappingHistory)
        .where(
            MappingHistory.tenant_id == tenant_id,
            MappingHistory.bank_code == bank_code,
            MappingHistory.field_type.in_(field_types),
            MappingHistory.deleted_at.is_(None),
        )
        .order_by(MappingHistory.confirmed_count.desc())
    )
    rows = result.scalars().all()

    best: dict[str, dict] = {}
    for row in rows:
        ft = str(row.field_type)
        if ft not in best:  # first row = highest confirmed_count due to ORDER BY
            best[ft] = {
                "dept": row.dept_code,
                "acc": row.acc_code,
                "confirmed_count": row.confirmed_count or 0,
            }
    return best
