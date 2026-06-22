"""Admin top-up credit management — balance, top-up, manual adjust, ledger, slip review."""

import logging
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.admin_session import AdminPrincipal
from app.database import get_db
from app.models.enums import BillingDocumentType, CreditLedgerReason, CreditOrderStatus
from app.models.orm import BillingDocument, CreditLedger, CreditOrder, CreditPack, Tenant
from app.models.schemas import (
    AdjustRequest,
    BillingDocumentResponse,
    CreditBalanceResponse,
    CreditLedgerEntry,
    CreditOrderResponse,
    HoldRequest,
    PaymentInfoResponse,
    RejectRequest,
    TopupRequest,
)
from app.services import billing_document_service as bds
from app.services import storage_service
from app.services.credit_service import activate_subscription, get_credit_balance, grant_credits
from app.services.storage_service import StorageError

from .deps import require_permission

logger = logging.getLogger(__name__)
router = APIRouter()

# An order can be approved/rejected from either the review queue or while parked
# on hold (admin contacted the buyer and is confirming).
_DECIDABLE = {CreditOrderStatus.AWAITING_REVIEW, CreditOrderStatus.ON_HOLD}


def _assert_scope(admin: AdminPrincipal, tenant_id: str) -> None:
    """Scoped admins may only act on their own tenant."""
    if not admin.is_global and admin.tenant_scope != tenant_id:
        raise HTTPException(status_code=403, detail="Tenant out of scope")


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
    query = (
        select(CreditOrder, Tenant.name)
        .join(Tenant, Tenant.id == CreditOrder.tenant_id)
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
        query = query.where(CreditOrder.status == CreditOrderStatus.AWAITING_REVIEW)

    query = query.order_by(CreditOrder.created_at.asc()).limit(limit)
    rows = (await db.execute(query)).all()

    out: list[CreditOrderResponse] = []
    for order, tenant_name in rows:
        resp = CreditOrderResponse.model_validate(order)
        resp.tenant_name = tenant_name
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
    """
    Approve a slip: grant credits, issue tax invoice, mark order paid.
    Only valid when status=awaiting_review.
    """
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

    if order.status not in _DECIDABLE:
        raise HTTPException(
            status_code=409,
            detail=f"Order is in status '{order.status}', expected awaiting_review or on_hold",
        )

    # Fetch proforma buyer info for the tax invoice snapshot
    proforma = (
        await db.execute(
            select(BillingDocument).where(
                BillingDocument.order_id == order_id,
                BillingDocument.doc_type == BillingDocumentType.PROFORMA,
                BillingDocument.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()

    buyer = bds.BuyerInfo(
        name=str(proforma.buyer_name or "") if proforma else "",
        tax_id=str(proforma.buyer_tax_id or "") if proforma else "",
        address=str(proforma.buyer_address or "") if proforma else "",
        branch=str(proforma.buyer_branch or "") if proforma else "",
        contact_name=str(proforma.buyer_contact_name or "") if proforma else "",
    )

    await bds.issue_document(
        db,
        tenant_id=str(order.tenant_id),
        order_id=order_id,
        doc_type=BillingDocumentType.TAX_INVOICE,
        pack_code=order.pack_code,  # type: ignore[arg-type]
        pack_description=f"{order.credits} credits",
        credits=order.credits,  # type: ignore[arg-type]
        amount_thb=Decimal(str(order.amount_thb)),
        buyer=buyer,
    )

    # Subscription packs open a one-month use-it-or-lose-it window; top-up packs
    # grant non-expiring credits. Both still issue the tax invoice + mark PAID.
    pack = (
        await db.execute(select(CreditPack).where(CreditPack.code == order.pack_code))
    ).scalar_one_or_none()
    if pack is not None and pack.kind == "subscription":
        await activate_subscription(
            db,
            str(order.tenant_id),
            str(order.pack_code),
            int(order.credits),  # type: ignore[arg-type]
            order_id,
        )
        fulfilled = f"subscription:{order.pack_code}"
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
    """
    Reject a slip: mark order rejected with a reason.
    The tenant may create a new order for the same pack after rejection.
    """
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

    if order.status not in _DECIDABLE:
        raise HTTPException(
            status_code=409,
            detail=f"Order is in status '{order.status}', expected awaiting_review or on_hold",
        )

    order.status = CreditOrderStatus.REJECTED  # type: ignore[assignment]
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
    """
    Park an order pending the buyer's reply (`hold=True`), or resume it back to the
    review queue (`hold=False`). Lets the admin confirm a questionable slip with the
    buyer instead of rejecting it outright. The optional note is admin-only.
    """
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

    if body.hold:
        if order.status != CreditOrderStatus.AWAITING_REVIEW:
            raise HTTPException(
                status_code=409,
                detail=f"Can only hold an awaiting_review order, not '{order.status}'",
            )
        order.status = CreditOrderStatus.ON_HOLD  # type: ignore[assignment]
        if body.note is not None:
            order.admin_note = body.note.strip() or None  # type: ignore[assignment]
    else:
        if order.status != CreditOrderStatus.ON_HOLD:
            raise HTTPException(
                status_code=409,
                detail=f"Can only resume an on_hold order, not '{order.status}'",
            )
        order.status = CreditOrderStatus.AWAITING_REVIEW  # type: ignore[assignment]

    await db.commit()
    await db.refresh(order)
    logger.info(
        "order hold=%s: id=%s tenant=%s by=%s", body.hold, order_id, order.tenant_id, admin.email
    )
    return CreditOrderResponse.model_validate(order)


@router.post("/credit-orders/{order_id}/cancel", response_model=CreditOrderResponse)
async def cancel_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("quotas", "write")),
):
    """
    Cancel (soft-delete) a still-pending order — one with no slip uploaded yet.
    Orders that already carry a slip go through Reject so the buyer sees a reason.
    """
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

    if order.status != CreditOrderStatus.PENDING:
        raise HTTPException(
            status_code=409,
            detail=f"Can only cancel a pending order, not '{order.status}'",
        )

    order.status = CreditOrderStatus.CANCELLED  # type: ignore[assignment]
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
    """Return all billing documents for an order (proforma + tax invoice)."""
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
