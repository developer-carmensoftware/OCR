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


async def list_history(
    db: AsyncSession, tenant_id: str, bank_code: str
) -> dict[str, dict]:
    """Return best confirmed mapping per field_type for a tenant+bank (for /history endpoint)."""
    result = await db.execute(
        select(MappingHistory)
        .where(
            MappingHistory.tenant_id == tenant_id,
            MappingHistory.bank_code == bank_code,
            MappingHistory.deleted_at.is_(None),
        )
        .order_by(MappingHistory.confirmed_count.desc(), MappingHistory.updated_at.desc())
    )
    history: dict[str, dict] = {}
    for row in result.scalars().all():
        if row.field_type not in history:
            history[str(row.field_type)] = {
                "dept": row.dept_code,
                "acc": row.acc_code,
                "confirmed_count": row.confirmed_count,
            }
    return history


async def save_history(
    db: AsyncSession,
    tenant_id: str,
    bank_code: str,
    mappings: dict,  # {field_type: FieldMapping}
) -> int:
    """Upsert confirmed GL mappings — increments confirmed_count on duplicates."""
    saved = 0
    for field_type, mapping in mappings.items():
        if not mapping.dept and not mapping.acc:
            continue

        existing_result = await db.execute(
            select(MappingHistory).where(
                MappingHistory.tenant_id == tenant_id,
                MappingHistory.bank_code == bank_code,
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
                    tenant_id=tenant_id,
                    bank_code=bank_code,
                    field_type=field_type,
                    dept_code=mapping.dept,
                    acc_code=mapping.acc,
                    confirmed_count=1,
                )
            )
        saved += 1

    await db.commit()
    logger.info("Saved %d mapping row(s) for bank=%s tenant=%s", saved, bank_code, tenant_id)
    return saved


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
