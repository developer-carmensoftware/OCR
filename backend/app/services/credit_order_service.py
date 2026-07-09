"""
Credit Order Service — slip-review queue, order lifecycle, AR profiles, AR posting, KPIs.

Business logic for routers/admin/credits.py's credit-orders endpoints. The router owns
auth (require_permission), per-request tenant-scope assertion, and response mapping;
this module owns queries, state transitions, and the Carmen AR posting workflow.
"""

import logging
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import and_, select, text
from sqlalchemy import func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ConflictError, NotFoundError
from app.models.billing import ArCustomerProfile
from app.models.enums import BillingDocumentType, CreditLedgerReason, CreditOrderStatus
from app.models.orm import BillingDocument, CreditOrder, CreditPack, Tenant
from app.models.schemas import CreditOrderResponse, KpiSummaryResponse
from app.models.schemas.credits import HoldBatchResultItem, PostArResultItem
from app.services import ar_posting_service, notification_service, storage_service
from app.services.credit_service import activate_subscription, grant_credits

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
    is_global: bool,
    tenant_scope: str,
) -> list[CreditOrderResponse]:
    """
    List credit orders across all tenants (global admin) or own tenant (scoped admin).
    Default view is the slip-review queue (awaiting_review); `status=all` returns
    every status; `tenant_id` narrows to one company's order history.
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

    query = query.order_by(CreditOrder.created_at.asc()).limit(limit)
    rows = (await db.execute(query)).all()

    out: list[CreditOrderResponse] = []
    for order, tenant_name, proforma_number, buyer_name, ar_code in rows:
        resp = CreditOrderResponse.model_validate(order)
        resp.tenant_name = tenant_name
        resp.proforma_number = proforma_number
        resp.buyer_name = buyer_name
        resp.carmen_ar_code = ar_code
        out.append(resp)
    return out


async def get_slip_url(order: CreditOrder, *, ttl_seconds: int = 300) -> dict:
    """Signed URL for the admin to view an order's uploaded slip.

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
            int(order.credits),  # type: ignore[arg-type]  # per-month allowance (both periods)
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


# ── AR Customer Profiles ─────────────────────────────────────────────────────


async def list_ar_profiles(
    db: AsyncSession, *, search: str | None, unmapped_only: bool
) -> list[ArCustomerProfile]:
    """List AR customer profiles for Carmen AR code mapping."""
    q = select(ArCustomerProfile).where(ArCustomerProfile.deleted_at.is_(None))
    if unmapped_only:
        q = q.where(ArCustomerProfile.carmen_ar_code.is_(None))
    if search:
        like = f"%{search}%"
        q = q.where(
            ArCustomerProfile.buyer_name.ilike(like) | ArCustomerProfile.buyer_tax_id.ilike(like)
        )
    q = q.order_by(ArCustomerProfile.buyer_name)
    return list((await db.execute(q)).scalars().all())


async def update_ar_profile(
    db: AsyncSession, profile_id: str, carmen_ar_code: str
) -> ArCustomerProfile:
    """Set or update the Carmen AR code for a customer profile."""
    profile = (
        await db.execute(
            select(ArCustomerProfile).where(
                ArCustomerProfile.id == profile_id,
                ArCustomerProfile.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if profile is None:
        raise NotFoundError("Profile not found")

    profile.carmen_ar_code = carmen_ar_code.strip().upper() or None  # type: ignore[assignment]
    profile.updated_at = datetime.now(UTC)  # type: ignore[assignment]
    return profile


async def sync_ar_profiles(db: AsyncSession) -> dict:
    """Re-scan billing_documents for new unique buyers and upsert into ar_customer_profiles."""
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    sub = (
        select(
            BillingDocument.buyer_name,
            BillingDocument.buyer_tax_id,
            BillingDocument.buyer_branch,
        )
        .where(
            BillingDocument.deleted_at.is_(None),
            BillingDocument.buyer_name.isnot(None),
            BillingDocument.buyer_name != "",
        )
        .distinct()
    )
    rows = (await db.execute(sub)).all()

    # Empty-tax-id buyers aren't covered by the (tax_id, branch) unique index, so
    # dedupe them in-app by (name, branch) to avoid piling up duplicates each sync.
    existing_empty = {
        (n, b)
        for n, b in (
            await db.execute(
                select(ArCustomerProfile.buyer_name, ArCustomerProfile.buyer_branch).where(
                    ArCustomerProfile.deleted_at.is_(None),
                    ArCustomerProfile.buyer_tax_id == "",
                )
            )
        ).all()
    }

    inserted = 0
    for name, tax_id, branch in rows:
        tax_id = tax_id or ""
        branch = branch or ""
        if not tax_id:
            if (name, branch) in existing_empty:
                continue
            existing_empty.add((name, branch))
            db.add(ArCustomerProfile(buyer_name=name, buyer_tax_id="", buyer_branch=branch))
            inserted += 1
            continue
        stmt = (
            pg_insert(ArCustomerProfile)
            .values(buyer_name=name, buyer_tax_id=tax_id, buyer_branch=branch)
            .on_conflict_do_nothing(
                index_elements=["buyer_tax_id", "buyer_branch"],
                index_where=text("deleted_at IS NULL AND buyer_tax_id != ''"),
            )
        )
        result = await db.execute(stmt)
        if result.rowcount:
            inserted += 1

    return {"inserted": inserted, "scanned": len(rows)}


# ── Carmen AR Posting ────────────────────────────────────────────────────────


async def post_ar_batch(
    db: AsyncSession,
    order_ids: list[str],
    *,
    is_global: bool,
    tenant_scope: str,
) -> list[PostArResultItem]:
    """Batch-post paid orders to Carmen ERP as AR entries."""
    results: list[PostArResultItem] = []

    for oid in order_ids:
        order = (
            await db.execute(
                select(CreditOrder)
                .where(CreditOrder.id == oid, CreditOrder.deleted_at.is_(None))
                .with_for_update()
            )
        ).scalar_one_or_none()

        if order is None:
            results.append(PostArResultItem(order_id=oid, success=False, error="Not found"))
            continue

        if not _in_scope(order, is_global=is_global, tenant_scope=tenant_scope):
            results.append(
                PostArResultItem(order_id=oid, success=False, error="Tenant out of scope")
            )
            continue

        if order.status != CreditOrderStatus.PAID:
            results.append(
                PostArResultItem(
                    order_id=oid, success=False, error=f"Status is '{order.status}', expected paid"
                )
            )
            continue

        # Look up AR code from the order's buyer (via proforma snapshot)
        proforma = (
            await db.execute(
                select(BillingDocument).where(
                    BillingDocument.order_id == oid,
                    BillingDocument.doc_type == BillingDocumentType.PROFORMA,
                    BillingDocument.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()

        ar_code = None
        if proforma and proforma.buyer_tax_id:
            profile = (
                await db.execute(
                    select(ArCustomerProfile).where(
                        ArCustomerProfile.buyer_tax_id == proforma.buyer_tax_id,
                        ArCustomerProfile.buyer_branch == (proforma.buyer_branch or ""),
                        ArCustomerProfile.deleted_at.is_(None),
                    )
                )
            ).scalar_one_or_none()
            if profile:
                ar_code = profile.carmen_ar_code

        if not ar_code:
            results.append(
                PostArResultItem(
                    order_id=oid, success=False, error="No AR code mapped for this buyer"
                )
            )
            continue

        # proforma is guaranteed non-None here — ar_code above was derived from it.
        assert proforma is not None
        try:
            resp = await ar_posting_service.post_ar_entry(
                # Carmen field mapping (interfacePostAR/CarmenAI):
                #   DealId=Proforma Invoice No, ClosingDate=Proforma Date,
                #   Description=Package+price, Remark=Contact Name/Tel/Email.
                # The proforma is the single source of truth for this order's figures
                # (no internal tax invoice is issued — Carmen ERP owns that document).
                deal_id=str(proforma.number),
                ar_code=str(ar_code),
                account_name=str(proforma.buyer_name or ""),
                closing_date=proforma.issue_date.isoformat() if proforma.issue_date else "",
                total=float(str(proforma.total)),
                net=float(str(proforma.subtotal)),
                vat=float(str(proforma.vat_amount)),
                description=f"Package : {proforma.description or order.pack_code} — {proforma.total} THB",
                remark=(
                    f"Contact Name : {proforma.buyer_contact_name or '-'}\n"
                    f"Tel. : {proforma.buyer_tel or '-'}\n"
                    f"Email : {proforma.buyer_email or '-'}"
                ),
            )
            order.status = CreditOrderStatus.COMPLETE  # type: ignore[assignment]
            order.carmen_ar_posted_at = datetime.now(UTC)  # type: ignore[assignment]
            order.carmen_ar_ref = resp["carmen_ar_ref"]  # type: ignore[assignment]
            results.append(
                PostArResultItem(order_id=oid, success=True, carmen_ar_ref=resp["carmen_ar_ref"])
            )
        except Exception as exc:
            logger.exception("AR posting failed for order %s", oid)
            results.append(PostArResultItem(order_id=oid, success=False, error=str(exc)))

    return results


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
