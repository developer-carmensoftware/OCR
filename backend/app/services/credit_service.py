"""
Credit Service — top-up credit balance, ledger, and document consumption.

Billing model — two pools, and only two:
  - An active subscription's monthly allowance. Use-it-or-lose-it: it resets each
    cycle and never rolls over.
  - `tenant_credits.balance`. Never expires. A new tenant is granted 30 of these
    (SIGNUP_GRANT_CREDITS) when their tenant row is created — that grant IS the
    free trial; there is no separate free-quota counter.

  A document is charged to the expiring pool first, so nothing a tenant paid for
  or was given can be stranded by the order of the checks.

  consume_document()     — subscription-first, then credits; atomic; → InsufficientCredits
  grant_credits()        — add/subtract credits + write ledger (caller owns txn)
  grant_signup_credits() — the one-time new-tenant grant (caller owns txn)
  get_credit_balance()   — current balance for a tenant (for /auth/usage)
"""

import logging
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlalchemy import case, func, select, text, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.context import current_document_ref, current_tenant_id
from app.database import async_session
from app.exceptions import ConflictError, InsufficientCredits, NotFoundError, ValidationError
from app.models.enums import CreditLedgerReason, CreditOrderStatus, SubscriptionStatus
from app.models.orm import (
    CreditLedger,
    CreditOrder,
    CreditPack,
    TenantCredit,
    TenantSubscription,
)
from app.utils.list_query import ListQuery, apply_list_query
from app.utils.pagination import paginate

logger = logging.getLogger(__name__)

# Annual = 10% off 12 months. The ONLY place the discount lives;
# /packs and create_order both call annual_price().
ANNUAL_DISCOUNT = Decimal("0.10")

# What a brand-new tenant is given, once, when their tenant row is created.
# This is the free trial: 30 documents that never expire (was the LIFETIME/CALLS
# quota rule until migration 20260813000100 folded it into the balance).
SIGNUP_GRANT_CREDITS = 30


def _ctx() -> str:
    return current_tenant_id.get() or ""


def annual_price(monthly: Decimal | float | str) -> Decimal:
    """Annual list price for a monthly tier = monthly × 12 × (1 − 10%), to 2dp."""
    return (Decimal(str(monthly)) * 12 * (1 - ANNUAL_DISCOUNT)).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )


def proration_credit(
    plan_net: Decimal,
    period_start: Any,
    period_end: Any,
    now: datetime,
) -> Decimal:
    """Remaining value of the current plan = list net × fraction of days left, to 2dp.

    ponytail: not called from create_order — provider wants full price on every
    purchase (no upgrade discount). Kept so re-enabling is a one-line change;
    credit_orders.proration_credit_thb stays in the schema (always 0 for now).
    """
    total = (period_end - period_start).total_seconds()
    if total <= 0:
        return Decimal("0.00")
    remaining = max(0.0, (period_end - now).total_seconds())
    frac = min(1.0, remaining / total)
    # ponytail: list price base, not paid amount — switch to source order subtotal if exact accounting needed
    return (plan_net * Decimal(str(frac))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def purchase_block_reason(
    cur_period: Any, cur_credits: Any, new_period: str, new_credits: int
) -> str | None:
    """Why a tenant with an active plan can't buy this one — or None if allowed.

    Downgrade (fewer docs) is never allowed. An annual subscriber can only move
    to another annual plan: switching to monthly mid-term would forfeit prepaid
    value (the smallest annual price > the largest monthly price), so it's blocked
    until the annual term lapses.
    """
    if new_credits < cur_credits:
        return "Downgrade is not supported."
    if cur_period == "annual" and new_period != "annual":
        return (
            "Your annual plan can't switch to monthly billing mid-term. "
            "Choose an annual plan or wait until it expires."
        )
    return None


async def _try_consume_subscription(db: AsyncSession, tenant_id: str, increment: int) -> bool:
    """
    Atomically charge one document against the tenant's active, in-window
    subscription allowance. Returns True if charged, False if there is no active
    subscription, the window has ended, or the monthly allowance is exhausted
    (use-it-or-lose-it). When the window has passed the WHERE simply fails — this
    is the lazy lapse enforcement; the daily cron only fixes display status.

    Monthly reset is done in-place: if now() has crossed into a new month-cycle
    (cycle_start < fn_cycle_start(period_start, now())), docs_used resets to 0
    before this charge and cycle_start steps forward. Monthly windows never cross
    a cycle (they are < 1 month), so they behave exactly as before; annual windows
    reset every month while the year-long license stays active.
    """
    target = func.fn_cycle_start(TenantSubscription.period_start, func.now())
    # docs_used as it should count for the *current* cycle (0 if the cycle rolled).
    effective_used = case(
        (TenantSubscription.cycle_start < target, 0),
        else_=TenantSubscription.docs_used,
    )
    stmt = (
        update(TenantSubscription)
        .where(
            TenantSubscription.tenant_id == tenant_id,
            TenantSubscription.status == SubscriptionStatus.ACTIVE,
            TenantSubscription.period_start <= func.now(),
            TenantSubscription.period_end > func.now(),
            effective_used + increment <= TenantSubscription.doc_allowance,
        )
        .values(
            docs_used=effective_used + increment,
            cycle_start=func.greatest(TenantSubscription.cycle_start, target),
            updated_at=func.now(),
        )
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
    Charge one document against the current tenant: active subscription allowance
    first, then the credit balance. Raises InsufficientCredits (→ 402) when both
    are spent.

    The expiring pool is charged first on purpose. A subscription's monthly
    allowance is use-it-or-lose-it while credits never expire, so taking credits
    first would quietly burn a tenant's permanent balance and let the allowance
    they already paid for evaporate at the cycle boundary.

    Returns what was charged — "subscription", "credit", or None (nothing charged:
    no tenant in context, or fail-open on an infra error). Pass the return value to
    refund_document() to reverse the charge if the extraction later fails.

    Fail-open on infra errors so a transient DB issue never blocks extraction —
    only an explicit out-of-credits condition raises.
    """
    tenant_id = _ctx()
    if not tenant_id:
        return None
    try:
        async with async_session() as db:
            async with db.begin():
                if await _try_consume_subscription(db, tenant_id, increment):
                    logger.info("subscription doc consumed: tenant=%s", tenant_id)
                    return "subscription"
                await _consume_credits(db, tenant_id, increment)
                return "credit"
    except InsufficientCredits:
        raise
    except Exception as exc:
        logger.exception("consume_document failed: %s", exc)
        return None


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
                    # Only reachable for a request the pre-merge code charged mid-deploy.
                    # Nothing to give back: the free-quota counter it incremented no
                    # longer gates anything (migration 20260813000100 retired the rule),
                    # so the tenant is already whole.
                    logger.info("refund_document: legacy 'free' charge — nothing to reverse")
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
    # `credits_purchased` means money received, so a signup grant must not touch it:
    # purchased credits are a prepaid liability and given ones are not, and the two
    # became indistinguishable in `balance` the moment the free trial moved in here.
    # The ledger reason stays the only place that distinction lives.
    purchased_delta = 0 if reason == CreditLedgerReason.SIGNUP_GRANT else max(0, amount)
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
    new_balance = int((await db.execute(stmt)).scalar_one())  # Numeric → int
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


async def grant_signup_credits(db: AsyncSession, tenant_id: str) -> int:
    """Give a brand-new tenant their free-trial credits. Returns the new balance.

    Call this ONLY on the transaction that inserted the tenant row, and let that
    transaction carry it: the grant then lives or dies with the tenant, which is
    what makes it a one-time grant without any bookkeeping of its own. A rollback
    takes the tenant with it, so the next login recreates both.

    `uq_credit_ledger_one_signup_grant` is the backstop — a second grant for the
    same tenant raises IntegrityError rather than quietly doubling the balance.
    """
    return await grant_credits(
        db,
        tenant_id,
        SIGNUP_GRANT_CREDITS,
        CreditLedgerReason.SIGNUP_GRANT,
        note="free trial",
    )


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
            return int(bal) if bal is not None else 0  # Numeric → int
    except Exception as exc:
        logger.error("get_credit_balance failed: %s", exc)
        return 0


async def topup_order(
    db: AsyncSession,
    tenant_id: str,
    pack_code: str,
    order_id: str | None,
    admin_email: str,
) -> int:
    """Grant a pack's worth of credits (offline-paid). Optionally mark an order paid.

    Caller owns the transaction (does not commit).
    """
    pack = (
        await db.execute(select(CreditPack).where(CreditPack.code == pack_code))
    ).scalar_one_or_none()
    if pack is None:
        raise NotFoundError("Credit pack not found")

    order_ref: str | None = None
    if order_id:
        # Lock the order row so a concurrent top-up or an admin approve racing this
        # top-up can't both pass the PAID check and grant credits twice.
        order = (
            await db.execute(
                select(CreditOrder).where(CreditOrder.id == order_id).with_for_update()
            )
        ).scalar_one_or_none()
        if order is None or order.tenant_id != tenant_id:
            raise NotFoundError("Order not found")
        if order.status == CreditOrderStatus.PAID:
            raise ConflictError("Order already fulfilled")
        order.status = CreditOrderStatus.PAID  # type: ignore[assignment]
        order.paid_at = datetime.now(UTC)  # type: ignore[assignment]
        order.approved_by = admin_email  # type: ignore[assignment]
        order.approved_at = datetime.now(UTC)  # type: ignore[assignment]
        order_ref = str(order.id)

    return await grant_credits(
        db,
        tenant_id,
        pack.credits,  # type: ignore[arg-type]
        reason=CreditLedgerReason.TOPUP,
        pack_code=pack.code,  # type: ignore[arg-type]
        ref=order_ref,
    )


async def adjust_balance(db: AsyncSession, tenant_id: str, delta: int, note: str | None) -> int:
    """Manual credit correction (positive or negative). Caller owns the transaction."""
    if delta == 0:
        raise ValidationError("delta must be non-zero")
    return await grant_credits(
        db, tenant_id, delta, reason=CreditLedgerReason.ADMIN_ADJUST, note=note
    )


async def get_ledger(
    db: AsyncSession,
    tenant_id: str,
    lq: ListQuery,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
) -> tuple[list[CreditLedger], int]:
    """Audit history of credit changes for a tenant, newest first.

    Paged and counted rather than capped: this used to return a flat newest-100 with no
    date filter and nothing saying there was more, so a tenant's 101st ledger entry was
    unreachable from the admin UI — on the one table that exists to be audited.
    """
    q = select(CreditLedger).where(CreditLedger.tenant_id == tenant_id)
    if from_date:
        q = q.where(CreditLedger.created_at >= from_date)
    if to_date:
        q = q.where(CreditLedger.created_at <= to_date)

    q = apply_list_query(
        q,
        lq,
        sortable={
            "created_at": CreditLedger.created_at,
            "reason": CreditLedger.reason,
            "delta": CreditLedger.delta,
            "balance_after": CreditLedger.balance_after,
        },
        tiebreak=CreditLedger.id,
        default_sort="created_at",
        searchable=(CreditLedger.reason, CreditLedger.note, CreditLedger.ref),
    )
    return await paginate(db, q, lq.limit, lq.offset)


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


async def active_subscription_map(db: AsyncSession, tenant_uuids: list) -> dict[str, dict]:
    """Bulk version of active_subscription for admin list views: one active, in-window
    subscription per tenant, keyed by str(tenant_id).

    Returns {str(tid): {"allowance": int, "used": int, "period_end": iso-str}}. `used` is
    cycle-adjusted with the SAME case() as _try_consume_subscription, so a rolled annual
    cycle shows 0 (what the next consume would count), not last cycle's stored docs_used.
    Keeping that expression here, next to the consume path, avoids a second copy drifting
    in the admin service.
    """
    if not tenant_uuids:
        return {}
    # Cycle-adjusted used — mirrors _try_consume_subscription's effective_used.
    used_effective = case(
        (
            TenantSubscription.cycle_start
            < func.fn_cycle_start(TenantSubscription.period_start, func.now()),
            0,
        ),
        else_=TenantSubscription.docs_used,
    )
    rows = (
        (
            await db.execute(
                select(
                    TenantSubscription.tenant_id.label("tid"),
                    TenantSubscription.doc_allowance.label("allowance"),
                    used_effective.label("used"),
                    TenantSubscription.period_end.label("period_end"),
                ).where(
                    TenantSubscription.tenant_id.in_(tenant_uuids),
                    TenantSubscription.status == SubscriptionStatus.ACTIVE,
                    TenantSubscription.period_start <= func.now(),
                    TenantSubscription.period_end > func.now(),
                )
            )
        )
        .mappings()
        .all()
    )
    # The partial unique index uq_tenant_subscriptions_one_active guarantees ≤1 active
    # row per tenant, so no de-dup is needed here.
    return {
        str(r["tid"]): {
            "allowance": int(r["allowance"] or 0),
            "used": int(r["used"] or 0),
            "period_end": r["period_end"].isoformat() if r["period_end"] else None,
        }
        for r in rows
    }


async def get_active_subscription(tenant_id: str) -> TenantSubscription | None:
    """
    active_subscription() with its own session — for read-only callers (/usage).

    Exposes the *effective* docs_used: 0 when the monthly cycle has rolled but the
    tenant hasn't consumed yet this cycle (consume would reset it on next use).
    The detached, never-committed row carries the display value only.
    """
    if not tenant_id:
        return None
    try:
        async with async_session() as db:
            sub = await active_subscription(db, tenant_id)
            if sub is None:
                return None
            target = (
                await db.execute(select(func.fn_cycle_start(sub.period_start, func.now())))
            ).scalar()
            if sub.cycle_start is not None and target is not None and sub.cycle_start < target:
                sub.docs_used = 0  # type: ignore[assignment]  # display only — expunged, never persists
            db.expunge(sub)
            return sub
    except Exception as exc:
        logger.error("get_active_subscription failed: %s", exc)
        return None


async def activate_subscription(
    db: AsyncSession,
    tenant_id: str,
    plan_code: str,
    doc_allowance: int,
    source_order_id: str,
    billing_period: str = "monthly",
) -> None:
    """
    Open a fresh subscription window for the tenant (caller owns txn).

    The window is `now() → now() + term - 1 day` so consecutive licenses tile
    without overlapping on the boundary (a 24 Jun monthly license ends 23 Jul).
    term is one month (monthly) or one year (annual); annual keeps the same
    per-month doc_allowance and resets docs_used each month via cycle_start (see
    _try_consume_subscription). This is the only place period math lives.

    Supersedes any existing active row first. With the Option-A purchase guard
    there should be none, but doing it unconditionally keeps the unique index
    safe if the guard is ever relaxed.
    """
    term = "1 year" if billing_period == "annual" else "1 month"
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
            period_end=text(f"now() + interval '{term}' - interval '1 day'"),
            cycle_start=func.now(),
            billing_period=billing_period,
            status=SubscriptionStatus.ACTIVE,
            source_order_id=source_order_id,
        )
    )
