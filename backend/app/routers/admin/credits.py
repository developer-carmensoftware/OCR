"""Admin credit management — balance, top-up, adjust, ledger, slip review, AR posting.

Thin HTTP layer: auth deps, per-request tenant-scope assertion, and response mapping.
Business logic lives in services/credit_service.py (balance/topup/adjust/ledger) and
services/credit_order_service.py (credit-orders queue, AR profiles, AR posting, KPIs).
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.admin_session import AdminPrincipal
from app.database import get_db
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
from app.services import ar_posting_service, credit_order_service, storage_service  # noqa: F401
from app.services import billing_document_service as bds
from app.services.credit_service import (
    adjust_balance,
    get_credit_balance,
    get_ledger,
    topup_order,
)
from app.services.storage_service import StorageError

# ar_posting_service and storage_service are unused directly here (their calls now
# live in credit_order_service) but stay imported under this module's name because
# tests/integration/test_admin_credits_api.py patches them at
# "app.routers.admin.credits.{ar_posting_service,storage_service}.*" — patching a
# module attribute mutates the shared module object, so it still takes effect
# wherever credit_order_service calls it.
from .deps import require_permission

logger = logging.getLogger(__name__)
router = APIRouter()


def _assert_scope(admin: AdminPrincipal, tenant_id: str) -> None:
    """Scoped admins may only act on their own tenant."""
    if not admin.is_global and admin.tenant_scope != tenant_id:
        raise HTTPException(status_code=403, detail="Tenant out of scope")


# ── Balance / topup / adjust / ledger ────────────────────────────────────────


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
    balance = await topup_order(db, tenant_id, body.pack_code, body.order_id, admin.email)
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
    balance = await adjust_balance(db, tenant_id, body.delta, body.note)
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
    rows = await get_ledger(db, tenant_id, limit)
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
    return await credit_order_service.list_orders(
        db,
        status=status,
        has_slip=has_slip,
        tenant_id=tenant_id,
        limit=limit,
        is_global=admin.is_global,
        tenant_scope=admin.tenant_scope,
    )


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
    order = await credit_order_service.get_order(db, order_id)
    _assert_scope(admin, str(order.tenant_id))
    try:
        return await credit_order_service.get_slip_url(order)
    except StorageError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("/credit-orders/{order_id}/approve", response_model=CreditOrderResponse)
async def approve_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("quotas", "write")),
):
    """Approve a slip: grant credits, mark order paid."""
    order = await credit_order_service.get_order_for_update(db, order_id)
    _assert_scope(admin, str(order.tenant_id))

    fulfilled = await credit_order_service.approve(db, order)
    order.approved_by = admin.email  # type: ignore[assignment]

    await db.commit()
    await db.refresh(order)

    logger.info(
        "order approved: id=%s tenant=%s credits=%s fulfilled=%s by=%s",
        order_id,
        order.tenant_id,
        order.credits,
        fulfilled,
        admin.admin_id,
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
    order = await credit_order_service.get_order_for_update(db, order_id)
    _assert_scope(admin, str(order.tenant_id))

    credit_order_service.reject(order, body.reason)

    await db.commit()
    await db.refresh(order)

    logger.info(
        "order rejected: id=%s tenant=%s reason=%r by=%s",
        order_id,
        order.tenant_id,
        body.reason,
        admin.admin_id,
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
    order = await credit_order_service.get_order_for_update(db, order_id)
    _assert_scope(admin, str(order.tenant_id))

    credit_order_service.hold(order, body.note)

    await db.commit()
    await db.refresh(order)
    logger.info("order note updated: id=%s by=%s", order_id, admin.admin_id)
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
    results = await credit_order_service.hold_batch(
        db, body.order_ids, is_global=admin.is_global, tenant_scope=admin.tenant_scope
    )
    await db.commit()
    logger.info("orders parked to on_hold: ids=%s by=%s", body.order_ids, admin.admin_id)
    return HoldBatchResponse(results=results)


@router.post("/credit-orders/{order_id}/cancel", response_model=CreditOrderResponse)
async def cancel_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("quotas", "write")),
):
    """Cancel (void + soft-delete) an in-progress or on_hold order."""
    order = await credit_order_service.get_order_for_update(db, order_id)
    _assert_scope(admin, str(order.tenant_id))

    credit_order_service.cancel(order)

    await db.commit()
    await db.refresh(order)
    logger.info("order cancelled: id=%s tenant=%s by=%s", order_id, order.tenant_id, admin.admin_id)
    return CreditOrderResponse.model_validate(order)


@router.get("/credit-orders/{order_id}/documents", response_model=list[BillingDocumentResponse])
async def list_order_documents(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("quotas", "read")),
):
    """Return all billing documents for an order (proforma; legacy orders may also
    carry an internal tax invoice from before this system stopped issuing them)."""
    order = await credit_order_service.get_order(db, order_id)
    _assert_scope(admin, str(order.tenant_id))
    docs = await credit_order_service.list_order_documents(db, order_id)
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
    rows = await credit_order_service.list_ar_profiles(
        db, search=search, unmapped_only=unmapped_only
    )
    return [ArCustomerProfileResponse.model_validate(r) for r in rows]


@router.patch("/ar-customer-profiles/{profile_id}", response_model=ArCustomerProfileResponse)
async def update_ar_profile(
    profile_id: str,
    body: ArCustomerProfileUpdate,
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("quotas", "write")),
):
    """Set or update the Carmen AR code for a customer profile."""
    profile = await credit_order_service.update_ar_profile(db, profile_id, body.carmen_ar_code)
    await db.commit()
    await db.refresh(profile)
    logger.info(
        "AR profile updated: id=%s ar_code=%s by=%s",
        profile_id,
        profile.carmen_ar_code,
        admin.admin_id,
    )
    return ArCustomerProfileResponse.model_validate(profile)


@router.post("/ar-customer-profiles/sync")
async def sync_ar_profiles(
    db: AsyncSession = Depends(get_db),
    _admin: AdminPrincipal = Depends(require_permission("quotas", "write")),
):
    """Re-scan billing_documents for new unique buyers and upsert into ar_customer_profiles."""
    result = await credit_order_service.sync_ar_profiles(db)
    await db.commit()
    return result


# ── Carmen AR Posting ────────────────────────────────────────────────────────


@router.post("/credit-orders/post-ar", response_model=PostArResponse)
async def post_ar_batch(
    body: PostArRequest,
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("quotas", "write")),
):
    """Batch-post paid orders to Carmen ERP as AR entries."""
    results = await credit_order_service.post_ar_batch(
        db, body.order_ids, is_global=admin.is_global, tenant_scope=admin.tenant_scope
    )
    await db.commit()
    return PostArResponse(results=results)


# ── KPI Summary ──────────────────────────────────────────────────────────────


@router.get("/credit-orders/kpi", response_model=KpiSummaryResponse)
async def get_kpi(
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("quotas", "read")),
):
    """KPI summary for the order-review dashboard."""
    return await credit_order_service.get_kpi(
        db, is_global=admin.is_global, tenant_scope=admin.tenant_scope
    )
