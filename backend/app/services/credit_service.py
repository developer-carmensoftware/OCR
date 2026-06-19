"""
Credit Service — top-up credit balance, ledger, and document consumption.

Billing model:
  - Every tenant has a free trial quota (the LIFETIME/CALLS rule in `quotas`,
    limit 30). It never resets — used once, then gone.
  - When the free trial is exhausted, a document consumes one persistent top-up
    credit (table `tenant_credits`). Credits never expire — they roll over.

  consume_document()   — free-quota-first, then credits; atomic; → InsufficientCredits
  grant_credits()      — add/subtract credits + write ledger (caller owns txn)
  get_credit_balance() — current balance for a tenant (for /auth/usage)
"""

import logging

from sqlalchemy import func, select, text, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.context import current_document_ref
from app.database import async_session
from app.exceptions import InsufficientCredits, ValidationError
from app.models.enums import CreditLedgerReason, QuotaPeriod, SubscriptionStatus
from app.models.orm import CreditLedger, QuotaUsage, TenantCredit, TenantSubscription
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


async def _try_consume_subscription(db: AsyncSession, tenant_id: str, increment: int) -> bool:
    """
    Atomically charge one document against the tenant's active, in-window
    subscription allowance. Returns True if charged, False if there is no active
    subscription, the window has ended, or the monthly allowance is exhausted
    (use-it-or-lose-it). When the window has passed the WHERE simply fails — this
    is the lazy lapse enforcement; the daily cron only fixes display status.
    """
    stmt = (
        update(TenantSubscription)
        .where(
            TenantSubscription.tenant_id == tenant_id,
            TenantSubscription.status == SubscriptionStatus.ACTIVE,
            TenantSubscription.period_start <= func.now(),
            TenantSubscription.period_end > func.now(),
            TenantSubscription.docs_used + increment <= TenantSubscription.doc_allowance,
        )
        .values(docs_used=TenantSubscription.docs_used + increment, updated_at=func.now())
        .returning(TenantSubscription.docs_used)
    )
    return (await db.execute(stmt)).first() is not None


async def _refund_subscription(db: AsyncSession, tenant_id: str, increment: int) -> None:
    """Give back a subscription document consumed this window (floored at 0)."""
    await db.execute(
        update(TenantSubscription)
        .where(
            TenantSubscription.tenant_id == tenant_id,
            TenantSubscription.status == SubscriptionStatus.ACTIVE,
            TenantSubscription.period_end > func.now(),
        )
        .values(
            docs_used=func.greatest(TenantSubscription.docs_used - increment, 0),
            updated_at=func.now(),
        )
    )


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
    raw_ref = current_document_ref.get() or None
    db.add(
        CreditLedger(
            tenant_id=tenant_id,
            delta=-increment,
            balance_after=int(row[0]),
            reason=CreditLedgerReason.CONSUMPTION,
            ref=raw_ref,
        )
    )
    logger.info(
        "credit consumed: tenant=%s delta=-%d balance_after=%d ref=%s",
        tenant_id,
        increment,
        int(row[0]),
        raw_ref,
    )


async def consume_document(increment: int = 1) -> str | None:
    """
    Charge one document against the current tenant, in priority order:
    active subscription allowance → free trial quota → top-up credits. Raises
    InsufficientCredits (→ 402) when all three are spent.

    Returns what was charged — "subscription", "free", "credit", or None
    (nothing charged: fail-open / no enforceable quota). Pass the return value to
    refund_document() to reverse the charge if the extraction later fails.

    Fail-open on missing quota / infra errors (mirrors consume_quota) so a
    transient DB issue never blocks extraction — only an explicit out-of-credits
    condition raises.
    """
    tenant_id = _ctx()
    if not tenant_id:
        return None
    try:
        rules = await _get_cached_quota_rules(tenant_id)
        monthly = next((q for q in rules if q.period == QuotaPeriod.LIFETIME), None)
        if monthly is None or monthly.limit_value <= 0:
            return None  # no enforceable free quota → fail-open (legacy no-quota behavior)

        async with async_session() as db:
            async with db.begin():
                if await _try_consume_subscription(db, tenant_id, increment):
                    logger.info("subscription doc consumed: tenant=%s", tenant_id)
                    return "subscription"
                if await _try_consume_free(db, monthly, increment):
                    logger.info(
                        "free slot consumed: tenant=%s limit=%.0f",
                        tenant_id,
                        monthly.limit_value,
                    )
                    return "free"
                await _consume_credits(db, tenant_id, increment)
                return "credit"
    except InsufficientCredits:
        raise
    except Exception as exc:
        logger.exception("consume_document failed: %s", exc)
        return None


async def _refund_free(db: AsyncSession, tenant_id: str, increment: int) -> None:
    """Give back a free slot consumed this period (floored at 0)."""
    rules = await _get_cached_quota_rules(tenant_id)
    monthly = next((q for q in rules if q.period == QuotaPeriod.LIFETIME), None)
    if monthly is None:
        return
    await db.execute(
        update(QuotaUsage)
        .where(
            QuotaUsage.quota_id == monthly.id, QuotaUsage.period_key == _period_key(monthly.period)
        )
        .values(used=func.greatest(QuotaUsage.used - increment, 0), last_updated_at=_utcnow())
    )


async def refund_document(charged: str | None, increment: int = 1) -> None:
    """Reverse a consume_document() charge after a downstream failure (e.g. the LLM
    call errored/timed out), so a failed extraction never burns the user's document.

    `charged` is the value returned by consume_document(). No-op for None.
    Fail-open: a refund failure is logged, never raised — it must not mask the
    original error that triggered the refund.
    """
    if charged is None:
        return
    tenant_id = _ctx()
    if not tenant_id:
        return
    try:
        async with async_session() as db:
            async with db.begin():
                if charged == "subscription":
                    await _refund_subscription(db, tenant_id, increment)
                elif charged == "free":
                    await _refund_free(db, tenant_id, increment)
                elif charged == "credit":
                    await grant_credits(
                        db,
                        tenant_id,
                        increment,
                        CreditLedgerReason.REFUND,
                        ref=current_document_ref.get() or None,
                        note="extraction failed",
                    )
                else:
                    logger.warning(
                        "refund_document: unexpected charged value %r — skipped", charged
                    )
        logger.info(
            "document refunded: tenant=%s charged=%s amount=%d", tenant_id, charged, increment
        )
    except Exception as exc:
        logger.exception("refund_document failed: %s", exc)


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


# ── Subscriptions ─────────────────────────────────────────────────────────────


async def active_subscription(db: AsyncSession, tenant_id: str) -> TenantSubscription | None:
    """
    The tenant's current in-window active subscription, or None.

    Single source of truth for "does this tenant have a live plan?" — used both
    by the purchase guard (Option A blocks a new subscription while one is active)
    and the /usage display. Window-based on purpose: a future-dated/queued row
    (Option B) is correctly ignored until its window opens.
    """
    return (
        await db.execute(
            select(TenantSubscription)
            .where(
                TenantSubscription.tenant_id == tenant_id,
                TenantSubscription.status == SubscriptionStatus.ACTIVE,
                TenantSubscription.period_start <= func.now(),
                TenantSubscription.period_end > func.now(),
            )
            .order_by(TenantSubscription.period_end.desc())
            .limit(1)
        )
    ).scalar_one_or_none()


async def get_active_subscription(tenant_id: str) -> TenantSubscription | None:
    """active_subscription() with its own session — for read-only callers (/usage)."""
    if not tenant_id:
        return None
    try:
        async with async_session() as db:
            return await active_subscription(db, tenant_id)
    except Exception as exc:
        logger.error("get_active_subscription failed: %s", exc)
        return None


async def activate_subscription(
    db: AsyncSession,
    tenant_id: str,
    plan_code: str,
    doc_allowance: int,
    source_order_id: str,
) -> None:
    """
    Open a fresh one-month subscription window for the tenant (caller owns txn).

    ponytail: period is anchored at now() → same day next month (Postgres
    `+ interval '1 month'` clamps Jan 31 → Feb 28). This is the only place period
    math lives — Option C (extend from the current period_end) changes just the
    period_start/period_end expressions here; Option B (queued renewal) adds a
    'scheduled' status and a promote cron and relaxes the purchase guard.

    Supersedes any existing active row first. With the Option-A purchase guard
    there should be none, but doing it unconditionally keeps the unique index
    safe if the guard is ever relaxed.
    """
    await db.execute(
        update(TenantSubscription)
        .where(
            TenantSubscription.tenant_id == tenant_id,
            TenantSubscription.status == SubscriptionStatus.ACTIVE,
        )
        .values(status=SubscriptionStatus.SUPERSEDED, updated_at=func.now())
    )
    await db.execute(
        pg_insert(TenantSubscription).values(
            tenant_id=tenant_id,
            plan_code=plan_code,
            doc_allowance=doc_allowance,
            docs_used=0,
            period_start=func.now(),
            period_end=text("now() + interval '1 month'"),
            status=SubscriptionStatus.ACTIVE,
            source_order_id=source_order_id,
        )
    )
