"""Admin credit management — balance, top-up, adjust, ledger, slip review, AR posting."""

import logging
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, select, text
from sqlalchemy import func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.admin_session import AdminPrincipal
from app.database import get_db
from app.models.billing import ArCustomerProfile
from app.models.enums import BillingDocumentType, CreditLedgerReason, CreditOrderStatus
from app.models.orm import BillingDocument, CreditLedger, CreditOrder, CreditPack, Tenant
from app.models.schemas import (
    AdjustRequest,
    ArCustomerProfileResponse,
    ArCustomerProfileUpdate,
    BillingDocumentResponse,
    CreditBalanceResponse,
    CreditLedgerEntry,
    CreditOrderResponse,
    HoldBatchRequest,
    HoldBatchResponse,
    HoldRequest,
    KpiSummaryResponse,
    PaymentInfoResponse,
    PostArRequest,
    PostArResponse,
    RejectRequest,
    TopupRequest,
)
from app.models.schemas.credits import HoldBatchResultItem, PostArResultItem
from app.services import ar_posting_service, storage_service
from app.services import billing_document_service as bds
from app.services.credit_service import activate_subscription, get_credit_balance, grant_credits
from app.services.storage_service import StorageError

from .deps import require_permission

logger = logging.getLogger(__name__)
router = APIRouter()


def _assert_scope(admin: AdminPrincipal, tenant_id: str) -> None:
    """Scoped admins may only act on their own tenant."""
    if not admin.is_global and admin.tenant_scope != tenant_id:
        raise HTTPException(status_code=403, detail="Tenant out of scope")


# Orders still open for an admin decision — in_progress (routine) or on_hold
# (auto-parked past its 14-day expiry, awaiting buyer contact).
_DECIDABLE = (CreditOrderStatus.IN_PROGRESS, CreditOrderStatus.ON_HOLD)


# ── Balance / topup / adjust / ledger (existing) ─────────────────────────────


@router.get("/tenants/{tenant_id}/credits", response_model=CreditBalanceResponse)
async def get_balance(
    tenant_id: str,
    admin: AdminPrincipal = Depends(require_permission("quotas", "read")),
):
    """Current top-up credit balance for a tenant."""
    _assert_scope(admin, tenant_id)
    balance = await get_credit_balance(tenant_id)
    return CreditBalanceResponse(tenant_id=tenant_id, balance=balance)


@router.post("/tenants/{tenant_id}/credits/topup", response_model=CreditBalanceResponse)
async def topup(
    tenant_id: str,
    body: TopupRequest,
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("quotas", "write")),
):
    """Grant a pack's worth of credits (offline-paid). Optionally mark an order paid."""
    _assert_scope(admin, tenant_id)

    pack = (
        await db.execute(select(CreditPack).where(CreditPack.code == body.pack_code))
    ).scalar_one_or_none()
    if pack is None:
        raise HTTPException(status_code=404, detail="Credit pack not found")

    order_ref: str | None = None
    if body.order_id:
        order = (
            await db.execute(select(CreditOrder).where(CreditOrder.id == body.order_id))
        ).scalar_one_or_none()
        if order is None or order.tenant_id != tenant_id:
            raise HTTPException(status_code=404, detail="Order not found")
        if order.status == CreditOrderStatus.PAID:
            raise HTTPException(status_code=409, detail="Order already fulfilled")
        order.status = CreditOrderStatus.PAID  # type: ignore[assignment]
        order.paid_at = datetime.now(UTC)  # type: ignore[assignment]
        order.approved_by = admin.email  # type: ignore[assignment]
        order.approved_at = datetime.now(UTC)  # type: ignore[assignment]
        order_ref = str(order.id)

    balance = await grant_credits(
        db,
        tenant_id,
        pack.credits,  # type: ignore[arg-type]
        reason=CreditLedgerReason.TOPUP,
        pack_code=pack.code,  # type: ignore[arg-type]
        ref=order_ref,
    )
    await db.commit()
    return CreditBalanceResponse(tenant_id=tenant_id, balance=balance)


@router.post("/tenants/{tenant_id}/credits/adjust", response_model=CreditBalanceResponse)
async def adjust(
    tenant_id: str,
    body: AdjustRequest,
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("quotas", "write")),
):
    """Manual credit correction (positive or negative)."""
    _assert_scope(admin, tenant_id)
    if body.delta == 0:
        raise HTTPException(status_code=400, detail="delta must be non-zero")

    balance = await grant_credits(
        db, tenant_id, body.delta, reason=CreditLedgerReason.ADMIN_ADJUST, note=body.note
    )
    await db.commit()
    return CreditBalanceResponse(tenant_id=tenant_id, balance=balance)


@router.get("/tenants/{tenant_id}/credits/ledger", response_model=list[CreditLedgerEntry])
async def ledger(
    tenant_id: str,
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("quotas", "read")),
):
    """Audit history of credit changes for a tenant, newest first."""
    _assert_scope(admin, tenant_id)
    rows = (
        (
            await db.execute(
                select(CreditLedger)
                .where(CreditLedger.tenant_id == tenant_id)
                .order_by(CreditLedger.created_at.desc())
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return [CreditLedgerEntry.model_validate(r) for r in rows]


# ── Slip review queue ─────────────────────────────────────────────────────────


@router.get("/credit-orders", response_model=list[CreditOrderResponse])
async def list_credit_orders(
    status: str | None = Query(
        None, description="Status filter; omit → awaiting_review queue, 'all' → every status"
    ),
    has_slip: bool | None = Query(
        None,
        description="Split in_progress by slip: true → To Review queue, false → Awaiting Payment",
    ),
    tenant_id: str | None = Query(None, description="Limit to one company's orders (history)"),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("quotas", "read")),
):
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

    if not admin.is_global and admin.tenant_scope:
        query = query.where(CreditOrder.tenant_id == admin.tenant_scope)
    elif tenant_id:
        _assert_scope(admin, tenant_id)
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


@router.get("/payment-info", response_model=PaymentInfoResponse)
async def get_payment_info(
    db: AsyncSession = Depends(get_db),
    _admin: AdminPrincipal = Depends(require_permission("quotas", "read")),
):
    """Company pay-to details for proforma preview in the review modal."""
    return PaymentInfoResponse(**await bds.get_payment_info(db))


@router.get("/credit-orders/{order_id}/slip-url")
async def get_slip_signed_url(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("quotas", "read")),
):
    """Return a short-lived signed URL for the admin to view the uploaded slip."""
    order = (
        await db.execute(
            select(CreditOrder).where(
                CreditOrder.id == order_id,
                CreditOrder.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    _assert_scope(admin, str(order.tenant_id))

    if not order.slip_object_key:
        raise HTTPException(status_code=404, detail="No slip uploaded for this order")

    try:
        url = await storage_service.signed_url(order.slip_object_key, ttl_seconds=300)  # type: ignore[arg-type]
    except StorageError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return {"signed_url": url, "expires_in": 300}


@router.post("/credit-orders/{order_id}/approve", response_model=CreditOrderResponse)
async def approve_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("quotas", "write")),
):
    """Approve a slip: grant credits, mark order paid.

    No internal tax invoice is issued here — Carmen ERP is the system of record for
    the fiscal tax invoice. The proforma (issued at order-creation) is the single
    source of truth for this order's figures; post_ar reads amounts from it directly.
    """
    order = (
        await db.execute(
            select(CreditOrder)
            .where(
                CreditOrder.id == order_id,
                CreditOrder.deleted_at.is_(None),
            )
            .with_for_update()
        )
    ).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    _assert_scope(admin, str(order.tenant_id))

    if order.status not in _DECIDABLE:
        raise HTTPException(
            status_code=409,
            detail=f"Order is '{order.status}', expected in_progress or on_hold",
        )

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
            order_id,
            billing_period=str(order.billing_period),
        )
        fulfilled = f"subscription:{order.pack_code}:{order.billing_period}"
    else:
        balance = await grant_credits(
            db,
            str(order.tenant_id),
            order.credits,  # type: ignore[arg-type]
            reason=CreditLedgerReason.TOPUP,
            pack_code=order.pack_code,  # type: ignore[arg-type]
            ref=order_id,
        )
        fulfilled = f"credit balance_after={balance}"

    order.status = CreditOrderStatus.PAID  # type: ignore[assignment]
    order.paid_at = datetime.now(UTC)  # type: ignore[assignment]
    order.approved_by = admin.email  # type: ignore[assignment]
    order.approved_at = datetime.now(UTC)  # type: ignore[assignment]

    await db.commit()
    await db.refresh(order)

    logger.info(
        "order approved: id=%s tenant=%s credits=%s fulfilled=%s by=%s",
        order_id,
        order.tenant_id,
        order.credits,
        fulfilled,
        admin.email,
    )
    return CreditOrderResponse.model_validate(order)


@router.post("/credit-orders/{order_id}/reject", response_model=CreditOrderResponse)
async def reject_order(
    order_id: str,
    body: RejectRequest,
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("quotas", "write")),
):
    """Reject a slip: mark order void with a reason."""
    order = (
        await db.execute(
            select(CreditOrder)
            .where(
                CreditOrder.id == order_id,
                CreditOrder.deleted_at.is_(None),
            )
            .with_for_update()
        )
    ).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    _assert_scope(admin, str(order.tenant_id))

    if order.status not in _DECIDABLE:
        raise HTTPException(
            status_code=409,
            detail=f"Order is '{order.status}', expected in_progress or on_hold",
        )

    order.status = CreditOrderStatus.VOID  # type: ignore[assignment]
    order.rejected_reason = body.reason  # type: ignore[assignment]

    await db.commit()
    await db.refresh(order)

    logger.info(
        "order rejected: id=%s tenant=%s reason=%r by=%s",
        order_id,
        order.tenant_id,
        body.reason,
        admin.email,
    )
    return CreditOrderResponse.model_validate(order)


@router.post("/credit-orders/{order_id}/hold", response_model=CreditOrderResponse)
async def hold_order(
    order_id: str,
    body: HoldRequest,
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("quotas", "write")),
):
    """Update the admin note on an order still awaiting a decision."""
    order = (
        await db.execute(
            select(CreditOrder)
            .where(CreditOrder.id == order_id, CreditOrder.deleted_at.is_(None))
            .with_for_update()
        )
    ).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    _assert_scope(admin, str(order.tenant_id))

    if order.status not in _DECIDABLE:
        raise HTTPException(
            status_code=409,
            detail=f"Can only add notes to in_progress or on_hold orders, not '{order.status}'",
        )

    order.admin_note = (body.note or "").strip() or None  # type: ignore[assignment]

    await db.commit()
    await db.refresh(order)
    logger.info("order note updated: id=%s by=%s", order_id, admin.email)
    return CreditOrderResponse.model_validate(order)


@router.post("/credit-orders/hold-batch", response_model=HoldBatchResponse)
async def hold_batch(
    body: HoldBatchRequest,
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("quotas", "write")),
):
    """
    Batch-park in-progress orders to on_hold. A manual, on-demand version of the
    hourly expiry sweep (fn_hold_expired_orders) — admin pulls an order out of the
    active To Review queue today instead of waiting out the 14-day window. Distinct
    from `hold_order` above, which only edits the admin_note and never changes
    status; this endpoint changes status and nothing else (no note).
    """
    results: list[HoldBatchResultItem] = []

    for oid in body.order_ids:
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

        _assert_scope(admin, str(order.tenant_id))

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
        results.append(HoldBatchResultItem(order_id=oid, success=True))

    await db.commit()
    logger.info("orders parked to on_hold: ids=%s by=%s", body.order_ids, admin.email)
    return HoldBatchResponse(results=results)


@router.post("/credit-orders/{order_id}/cancel", response_model=CreditOrderResponse)
async def cancel_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("quotas", "write")),
):
    """Cancel (void + soft-delete) an in-progress or on_hold order."""
    order = (
        await db.execute(
            select(CreditOrder)
            .where(CreditOrder.id == order_id, CreditOrder.deleted_at.is_(None))
            .with_for_update()
        )
    ).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    _assert_scope(admin, str(order.tenant_id))

    if order.status not in _DECIDABLE:
        raise HTTPException(
            status_code=409,
            detail=f"Can only cancel an in_progress or on_hold order, not '{order.status}'",
        )

    order.status = CreditOrderStatus.VOID  # type: ignore[assignment]
    order.deleted_at = datetime.now(UTC)  # type: ignore[assignment]
    await db.commit()
    await db.refresh(order)
    logger.info("order cancelled: id=%s tenant=%s by=%s", order_id, order.tenant_id, admin.email)
    return CreditOrderResponse.model_validate(order)


@router.get("/credit-orders/{order_id}/documents", response_model=list[BillingDocumentResponse])
async def list_order_documents(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("quotas", "read")),
):
    """Return all billing documents for an order (proforma; legacy orders may also
    carry an internal tax invoice from before this system stopped issuing them)."""
    order = (
        await db.execute(
            select(CreditOrder).where(
                CreditOrder.id == order_id,
                CreditOrder.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    _assert_scope(admin, str(order.tenant_id))

    docs = (
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
    return [BillingDocumentResponse.model_validate(d) for d in docs]


# ── AR Customer Profiles ─────────────────────────────────────────────────────


@router.get("/ar-customer-profiles", response_model=list[ArCustomerProfileResponse])
async def list_ar_profiles(
    search: str | None = Query(None),
    unmapped_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _admin: AdminPrincipal = Depends(require_permission("quotas", "read")),
):
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
    rows = (await db.execute(q)).scalars().all()
    return [ArCustomerProfileResponse.model_validate(r) for r in rows]


@router.patch("/ar-customer-profiles/{profile_id}", response_model=ArCustomerProfileResponse)
async def update_ar_profile(
    profile_id: str,
    body: ArCustomerProfileUpdate,
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("quotas", "write")),
):
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
        raise HTTPException(status_code=404, detail="Profile not found")

    profile.carmen_ar_code = body.carmen_ar_code.strip().upper() or None  # type: ignore[assignment]
    profile.updated_at = datetime.now(UTC)  # type: ignore[assignment]
    await db.commit()
    await db.refresh(profile)
    logger.info(
        "AR profile updated: id=%s ar_code=%s by=%s",
        profile_id,
        profile.carmen_ar_code,
        admin.email,
    )
    return ArCustomerProfileResponse.model_validate(profile)


@router.post("/ar-customer-profiles/sync")
async def sync_ar_profiles(
    db: AsyncSession = Depends(get_db),
    _admin: AdminPrincipal = Depends(require_permission("quotas", "write")),
):
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

    await db.commit()
    return {"inserted": inserted, "scanned": len(rows)}


# ── Carmen AR Posting ────────────────────────────────────────────────────────


@router.post("/credit-orders/post-ar", response_model=PostArResponse)
async def post_ar_batch(
    body: PostArRequest,
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("quotas", "write")),
):
    """Batch-post paid orders to Carmen ERP as AR entries."""
    results: list[PostArResultItem] = []

    for oid in body.order_ids:
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

        _assert_scope(admin, str(order.tenant_id))

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

    await db.commit()
    return PostArResponse(results=results)


# ── KPI Summary ──────────────────────────────────────────────────────────────


@router.get("/credit-orders/kpi", response_model=KpiSummaryResponse)
async def get_kpi(
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("quotas", "read")),
):
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
    if not admin.is_global and admin.tenant_scope:
        scope.append(CreditOrder.tenant_id == admin.tenant_scope)

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
