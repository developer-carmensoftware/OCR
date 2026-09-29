"""
Credit Order Service — slip-review queue, order lifecycle, KPIs.

Business logic for routers/admin/credits.py's credit-orders endpoints. The router owns
auth (require_permission), per-request tenant-scope assertion, and response mapping;
this module owns queries and state transitions. AR customer profiles and the Carmen AR
batch post live in ar_posting.py.
"""

import logging
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import and_, select
from sqlalchemy import func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ConflictError, NotFoundError
from app.models.billing import ArCustomerProfile
from app.models.enums import BillingDocumentType, CreditLedgerReason, CreditOrderStatus
from app.models.orm import BillingDocument, CreditOrder, CreditPack, Tenant
from app.models.schemas import CreditOrderResponse, KpiSummaryResponse
from app.models.schemas.credits import HoldBatchResultItem
from app.services.billing import slip_storage as storage_service
from app.services.shared import notification as notification_service
from app.services.shared.credits import activate_subscription, grant_credits
from app.utils.pagination import count_rows

logger = logging.getLogger(__name__)

# Orders still open for an admin decision — in_progress (routine) or on_hold
# (auto-parked past its 14-day expiry, awaiting buyer contact).
_DECIDABLE = (CreditOrderStatus.IN_PROGRESS, CreditOrderStatus.ON_HOLD)


def _in_scope(order: CreditOrder, *, is_global: bool, tenant_scope: str) -> bool:
    return is_global or str(order.tenant_id) == tenant_scope


async def get_order(db: AsyncSession, order_id: str) -> CreditOrder:
    """Fetch a non-deleted order by id, no row lock (read-only endpoints)."""
    order = (
        await db.execute(
            select(CreditOrder).where(
                CreditOrder.id == order_id,
                CreditOrder.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if order is None:
        raise NotFoundError("Order not found")
    return order


async def get_order_for_update(db: AsyncSession, order_id: str) -> CreditOrder:
    """Fetch a non-deleted order by id with a row lock (mutating endpoints)."""
    order = (
        await db.execute(
            select(CreditOrder)
            .where(CreditOrder.id == order_id, CreditOrder.deleted_at.is_(None))
            .with_for_update()
        )
    ).scalar_one_or_none()
    if order is None:
        raise NotFoundError("Order not found")
    return order


def ensure_decidable(order: CreditOrder) -> None:
    """Raise if the order isn't in a state an admin can still act on."""
    if order.status not in _DECIDABLE:
        raise ConflictError(f"Order is '{order.status}', expected in_progress or on_hold")


# ── Slip review queue ─────────────────────────────────────────────────────────


async def list_orders(
    db: AsyncSession,
    *,
    status: str | None,
    has_slip: bool | None,
    tenant_id: str | None,
    limit: int,
    offset: int = 0,
    is_global: bool,
    tenant_scope: str,
) -> tuple[list[CreditOrderResponse], int]:
    """
    List credit orders across all tenants (global admin) or own tenant (scoped admin).
    Default view is the slip-review queue (awaiting_review); `status=all` returns
    every status; `tenant_id` narrows to one company's order history.

    Returns (window, total). `total` counts every matching order, not the window —
    without it the admin queue silently truncates at `limit` with nothing on screen
    saying so.
    """
    # Enrich each row with its proforma number and the AR code resolved from the
    # buyer's (tax_id, branch) — so the queue shows post-readiness at a glance.
    query = (
        select(
            CreditOrder,
            Tenant.name,
            BillingDocument.number,
            BillingDocument.buyer_name,
            ArCustomerProfile.carmen_ar_code,
        )
        .join(Tenant, Tenant.id == CreditOrder.tenant_id)
        .outerjoin(
            BillingDocument,
            and_(
                BillingDocument.order_id == CreditOrder.id,
                BillingDocument.doc_type == BillingDocumentType.PROFORMA,
                BillingDocument.deleted_at.is_(None),
            ),
        )
        .outerjoin(
            ArCustomerProfile,
            and_(
                ArCustomerProfile.buyer_tax_id == BillingDocument.buyer_tax_id,
                ArCustomerProfile.buyer_branch
                == sa_func.coalesce(BillingDocument.buyer_branch, ""),
                ArCustomerProfile.deleted_at.is_(None),
            ),
        )
        .where(CreditOrder.deleted_at.is_(None))
    )

    if not is_global and tenant_scope:
        query = query.where(CreditOrder.tenant_id == tenant_scope)
    elif tenant_id:
        query = query.where(CreditOrder.tenant_id == tenant_id)

    if status == "all":
        pass  # no status filter
    elif status:
        query = query.where(CreditOrder.status == status)
    else:
        query = query.where(CreditOrder.status == CreditOrderStatus.IN_PROGRESS)

    # Split in_progress into To Review (slip uploaded) vs Awaiting Payment (no slip).
    if has_slip is True:
        query = query.where(CreditOrder.slip_uploaded_at.is_not(None))
    elif has_slip is False:
        query = query.where(CreditOrder.slip_uploaded_at.is_(None))

    query = query.order_by(CreditOrder.created_at.asc())
    # count_rows, not paginate(): this selects five entities, and paginate's .scalars()
    # would flatten every row down to the CreditOrder alone.
    total = await count_rows(db, query)
    rows = (await db.execute(query.limit(limit).offset(offset))).all()

    out: list[CreditOrderResponse] = []
    for order, tenant_name, proforma_number, buyer_name, ar_code in rows:
        resp = CreditOrderResponse.model_validate(order)
        resp.tenant_name = tenant_name
        resp.proforma_number = proforma_number
        resp.buyer_name = buyer_name
        resp.carmen_ar_code = ar_code
        out.append(resp)
    return out, total


async def get_slip_url(order: CreditOrder, *, ttl_seconds: int = 3600) -> dict:
    """Presigned URL for the admin to view an order's uploaded slip.

    ttl_seconds mirrors the FileService URL lifetime (~1h) for the caller's
    expires_in; the actual TTL is fixed by FileService.

    Raises NotFoundError if no slip was uploaded; storage_service.StorageError
    (upstream failure) propagates to the router, which maps it to 502.
    """
    if not order.slip_object_key:
        raise NotFoundError("No slip uploaded for this order")
    url = await storage_service.signed_url(order.slip_object_key, ttl_seconds=ttl_seconds)  # type: ignore[arg-type]
    return {"signed_url": url, "expires_in": ttl_seconds}


async def approve(db: AsyncSession, order: CreditOrder) -> str:
    """Approve a slip: grant credits, mark order paid. Returns a fulfillment summary
    string for the caller to log.

    No internal tax invoice is issued here — Carmen ERP is the system of record for
    the fiscal tax invoice. The proforma (issued at order-creation) is the single
    source of truth for this order's figures; post_ar reads amounts from it directly.

    Does not stamp `approved_by` — the caller sets that directly so this function's
    return value (logged by the caller) never shares a scope with the admin's identity.
    """
    ensure_decidable(order)

    # Subscription packs open a one-month use-it-or-lose-it window; top-up packs
    # grant non-expiring credits. Both mark PAID below.
    pack = (
        await db.execute(select(CreditPack).where(CreditPack.code == order.pack_code))
    ).scalar_one_or_none()
    if pack is not None and pack.kind == "subscription":
        await activate_subscription(
            db,
            str(order.tenant_id),
            str(order.pack_code),
            int(order.credits),  # per-month allowance (both periods)
            str(order.id),
            billing_period=str(order.billing_period),
        )
        # ponytail: bare literal on purpose — pack_code/billing_period are recoverable
        # from the logged order_id, and interpolating them here makes CodeQL taint the
        # returned string into the caller's logger (py/clear-text-logging false positive).
        fulfilled = "subscription"
    else:
        balance = await grant_credits(
            db,
            str(order.tenant_id),
            order.credits,  # type: ignore[arg-type]
            reason=CreditLedgerReason.TOPUP,
            pack_code=order.pack_code,  # type: ignore[arg-type]
            ref=str(order.id),
        )
        fulfilled = f"credit balance_after={balance}"

    order.status = CreditOrderStatus.PAID  # type: ignore[assignment]
    order.paid_at = datetime.now(UTC)  # type: ignore[assignment]
    order.approved_at = datetime.now(UTC)  # type: ignore[assignment]
    return fulfilled


def reject(order: CreditOrder, reason: str) -> None:
    """Reject a slip: mark order void with a reason."""
    ensure_decidable(order)
    order.status = CreditOrderStatus.VOID  # type: ignore[assignment]
    order.rejected_reason = reason  # type: ignore[assignment]


def hold(order: CreditOrder, note: str | None) -> None:
    """Update the admin note on an order still awaiting a decision."""
    ensure_decidable(order)
    order.admin_note = (note or "").strip() or None  # type: ignore[assignment]


def cancel(order: CreditOrder) -> None:
    """Cancel (void + soft-delete) an in-progress or on_hold order."""
    ensure_decidable(order)
    order.status = CreditOrderStatus.VOID  # type: ignore[assignment]
    order.deleted_at = datetime.now(UTC)  # type: ignore[assignment]


async def hold_batch(
    db: AsyncSession,
    order_ids: list[str],
    *,
    is_global: bool,
    tenant_scope: str,
) -> list[HoldBatchResultItem]:
    """
    Batch-park in-progress orders to on_hold. A manual, on-demand version of the
    hourly expiry sweep (fn_hold_expired_orders) — admin pulls an order out of the
    active To Review queue today instead of waiting out the 14-day window. Distinct
    from `hold`, which only edits the admin_note and never changes status; this
    changes status and nothing else (no note).
    """
    results: list[HoldBatchResultItem] = []

    for oid in order_ids:
        order = (
            await db.execute(
                select(CreditOrder)
                .where(CreditOrder.id == oid, CreditOrder.deleted_at.is_(None))
                .with_for_update()
            )
        ).scalar_one_or_none()

        if order is None:
            results.append(HoldBatchResultItem(order_id=oid, success=False, error="Not found"))
            continue

        if not _in_scope(order, is_global=is_global, tenant_scope=tenant_scope):
            results.append(
                HoldBatchResultItem(order_id=oid, success=False, error="Tenant out of scope")
            )
            continue

        if order.status != CreditOrderStatus.IN_PROGRESS:
            results.append(
                HoldBatchResultItem(
                    order_id=oid,
                    success=False,
                    error=f"Status is '{order.status}', expected in_progress",
                )
            )
            continue

        order.status = CreditOrderStatus.ON_HOLD  # type: ignore[assignment]
        # Notify the buyer just like the cron auto-park does — same on_hold event,
        # different trigger. Caller (router) owns the commit.
        notification_service.notify(
            db, tenant_id=order.tenant_id, order_id=order.id, type_="on_hold", payload={}
        )
        results.append(HoldBatchResultItem(order_id=oid, success=True))

    return results


async def list_order_documents(db: AsyncSession, order_id: str) -> list[BillingDocument]:
    """All billing documents for an order (proforma; legacy orders may also carry an
    internal tax invoice from before this system stopped issuing them)."""
    return list(
        (
            await db.execute(
                select(BillingDocument)
                .where(
                    BillingDocument.order_id == order_id,
                    BillingDocument.deleted_at.is_(None),
                )
                .order_by(BillingDocument.created_at)
            )
        )
        .scalars()
        .all()
    )


# ── KPI Summary ──────────────────────────────────────────────────────────────


async def get_kpi(db: AsyncSession, *, is_global: bool, tenant_scope: str) -> KpiSummaryResponse:
    """KPI summary for the order-review dashboard."""
    unmapped = (
        await db.execute(
            select(sa_func.count())
            .select_from(ArCustomerProfile)
            .where(
                ArCustomerProfile.deleted_at.is_(None),
                ArCustomerProfile.carmen_ar_code.is_(None),
            )
        )
    ).scalar() or 0

    # Shared scope filter — applied consistently to every order-based metric.
    scope: list = [CreditOrder.deleted_at.is_(None)]
    if not is_global and tenant_scope:
        scope.append(CreditOrder.tenant_id == tenant_scope)

    # One grouped pass over (status, slip?) → sum + count. Every order sits in
    # exactly one stage, so the stage amounts form a funnel that reconciles to
    # total. in_progress splits by slip into awaiting_payment / to_review.
    has_slip = CreditOrder.slip_uploaded_at.is_not(None)
    rows = (
        await db.execute(
            select(
                CreditOrder.status,
                has_slip.label("has_slip"),
                sa_func.coalesce(sa_func.sum(CreditOrder.amount_thb), 0),
                sa_func.count(),
            )
            .where(*scope)
            .group_by(CreditOrder.status, has_slip)
        )
    ).all()

    amounts = {
        k: Decimal(0) for k in ("awaiting", "to_review", "on_hold", "to_post", "posted", "rejected")
    }
    counts = {k: 0 for k in amounts}
    for status, slip, amt, cnt in rows:
        s = str(getattr(status, "value", status))
        amt = Decimal(str(amt or 0))
        cnt = int(cnt or 0)
        if s == CreditOrderStatus.IN_PROGRESS.value:
            key = "to_review" if slip else "awaiting"
        elif s == CreditOrderStatus.ON_HOLD.value:
            key = "on_hold"
        elif s == CreditOrderStatus.PAID.value:
            key = "to_post"
        elif s == CreditOrderStatus.COMPLETE.value:
            key = "posted"
        else:  # VOID
            key = "rejected"
        amounts[key] += amt
        counts[key] += cnt

    # Total excludes rejected/void — only live requests still in the pipeline.
    total_amount = (
        amounts["awaiting"]
        + amounts["to_review"]
        + amounts["on_hold"]
        + amounts["to_post"]
        + amounts["posted"]
    )

    status_counts = {
        "awaiting_payment": counts["awaiting"],
        "to_review": counts["to_review"],
        "on_hold": counts["on_hold"],
        "to_post": counts["to_post"],
        "posted": counts["posted"],
        "rejected": counts["rejected"],
    }

    return KpiSummaryResponse(
        unmapped_count=unmapped,
        to_review_count=counts["to_review"],
        to_post_count=counts["to_post"],
        total_amount=float(total_amount),
        awaiting_amount=float(amounts["awaiting"]),
        to_review_amount=float(amounts["to_review"]),
        on_hold_amount=float(amounts["on_hold"]),
        to_post_amount=float(amounts["to_post"]),
        posted_amount=float(amounts["posted"]),
        rejected_amount=float(amounts["rejected"]),
        status_counts=status_counts,
    )
