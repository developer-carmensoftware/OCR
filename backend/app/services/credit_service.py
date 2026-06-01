"""
Credit Service — top-up credit balance, ledger, and document consumption.

Billing model:
  - Every tenant has a free monthly document quota (the MONTHLY/CALLS rule in
    `quotas`, limit 30). It auto-resets each month via the quota period_key.
  - When the free quota is exhausted, a document consumes one persistent top-up
    credit (table `tenant_credits`). Credits never expire — they roll over.

  consume_document()   — free-quota-first, then credits; atomic; → InsufficientCredits
  grant_credits()      — add/subtract credits + write ledger (caller owns txn)
  get_credit_balance() — current balance for a tenant (for /auth/usage)
"""

import logging

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.context import current_document_ref
from app.database import async_session
from app.exceptions import InsufficientCredits, ValidationError
from app.models.enums import CreditLedgerReason, QuotaPeriod
from app.models.orm import CreditLedger, QuotaUsage, TenantCredit
from app.services.quota_service import (
    _CachedQuota,
    _ctx,
    _get_cached_quota_rules,
    _period_key,
    _utcnow,
)

logger = logging.getLogger(__name__)


async def _try_consume_free(db: AsyncSession, quota: _CachedQuota, increment: int) -> bool:
    """
    Atomically increment the monthly free-quota usage, but only while it stays
    within the limit. Returns True if a free slot was consumed, False if the
    free quota is already exhausted for this period.
    """
    key = _period_key(quota.period)
    stmt = (
        pg_insert(QuotaUsage)
        .values(quota_id=quota.id, period_key=key, used=increment)
        .on_conflict_do_update(
            index_elements=["quota_id", "period_key"],
            set_={"used": QuotaUsage.used + increment, "last_updated_at": _utcnow()},
            # On conflict, only bump usage if it stays at/under the free limit.
            where=QuotaUsage.used + increment <= quota.limit_value,
        )
        .returning(QuotaUsage.used)
    )
    result = await db.execute(stmt)
    return result.first() is not None


async def _consume_credits(db: AsyncSession, tenant_id: str, increment: int) -> None:
    """Decrement the top-up balance by `increment` and log it, or raise."""
    stmt = (
        update(TenantCredit)
        .where(TenantCredit.tenant_id == tenant_id, TenantCredit.balance >= increment)
        .values(
            balance=TenantCredit.balance - increment,
            credits_consumed=TenantCredit.credits_consumed + increment,
        )
        .returning(TenantCredit.balance)
    )
    row = (await db.execute(stmt)).first()
    if row is None:
        raise InsufficientCredits(tenant_id)
    db.add(
        CreditLedger(
            tenant_id=tenant_id,
            delta=-increment,
            balance_after=int(row[0]),
            reason=CreditLedgerReason.CONSUMPTION,
            ref=(current_document_ref.get() or None),
        )
    )


async def consume_document(increment: int = 1) -> None:
    """
    Charge one document against the current tenant: free monthly quota first,
    then top-up credits. Raises InsufficientCredits (→ 402) when both are spent.

    Fail-open on missing quota / infra errors (mirrors consume_quota) so a
    transient DB issue never blocks extraction — only an explicit out-of-credits
    condition raises.
    """
    tenant_id = _ctx()
    if not tenant_id:
        return
    try:
        rules = await _get_cached_quota_rules(tenant_id)
        monthly = next((q for q in rules if q.period == QuotaPeriod.MONTHLY), None)
        if monthly is None or monthly.limit_value <= 0:
            return  # no enforceable free quota → fail-open (legacy no-quota behavior)

        async with async_session() as db:
            async with db.begin():
                if await _try_consume_free(db, monthly, increment):
                    return
                await _consume_credits(db, tenant_id, increment)
    except InsufficientCredits:
        raise
    except Exception as exc:
        logger.error("consume_document failed: %s", exc)


async def grant_credits(
    db: AsyncSession,
    tenant_id: str,
    amount: int,
    reason: CreditLedgerReason,
    *,
    pack_code: str | None = None,
    ref: str | None = None,
    note: str | None = None,
) -> int:
    """
    Upsert the tenant's credit balance by `amount` (may be negative for an
    admin adjustment/refund) and append a ledger row. Returns the new balance.

    The caller owns the transaction — this does not commit. Raises
    ValidationError if the result would be negative.
    """
    purchased_delta = max(0, amount)
    consumed_delta = max(0, -amount)
    stmt = (
        pg_insert(TenantCredit)
        .values(
            tenant_id=tenant_id,
            balance=amount,
            credits_purchased=purchased_delta,
            credits_consumed=consumed_delta,
        )
        .on_conflict_do_update(
            index_elements=["tenant_id"],
            set_={
                "balance": TenantCredit.balance + amount,
                "credits_purchased": TenantCredit.credits_purchased + purchased_delta,
                "credits_consumed": TenantCredit.credits_consumed + consumed_delta,
            },
        )
        .returning(TenantCredit.balance)
    )
    new_balance = int((await db.execute(stmt)).scalar_one())
    if new_balance < 0:
        raise ValidationError("Adjustment would make the credit balance negative.")
    db.add(
        CreditLedger(
            tenant_id=tenant_id,
            delta=amount,
            balance_after=new_balance,
            reason=reason,
            pack_code=pack_code,
            ref=ref,
            note=note,
        )
    )
    return new_balance


async def get_credit_balance(tenant_id: str) -> int:
    """Return the current top-up credit balance for a tenant (0 if none)."""
    if not tenant_id:
        return 0
    try:
        async with async_session() as db:
            bal = (
                await db.execute(
                    select(TenantCredit.balance).where(TenantCredit.tenant_id == tenant_id)
                )
            ).scalar_one_or_none()
            return int(bal) if bal is not None else 0
    except Exception as exc:
        logger.error("get_credit_balance failed: %s", exc)
        return 0
