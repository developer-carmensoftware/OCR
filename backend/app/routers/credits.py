"""
Tenant-facing top-up credit endpoints.

  GET  /api/v1/credits/packs               — purchasable pack catalog
  GET  /api/v1/credits/company-profile     — prefill buyer info (Carmen or last-invoice)
  POST /api/v1/credits/orders              — create order + PromptPay QR + proforma
  POST /api/v1/credits/orders/{id}/slip    — upload payment slip → awaiting_review
  GET  a              — list tenant's own orders
  GET  /api/v1/credits/orders/{id}         — single order detail
"""

import logging
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import SessionInfo, get_current_session
from app.database import get_db
from app.models.enums import BillingDocumentType, CreditOrderStatus
from app.models.orm import BillingDocument, CreditOrder, CreditPack
from app.models.schemas import (
    BillingDocumentResponse,
    CompanyProfileResponse,
    CreateOrderRequest,
    CreateOrderResponse,
    CreditOrderResponse,
    CreditPackResponse,
    PaymentInfoResponse,
    QrPayloadResponse,
    SlipUploadResponse,
)
from app.services import billing_document_service as bds
from app.services import carmen_service, promptpay_service, storage_service
from app.services.credit_service import active_subscription
from app.services.file_service import FileService
from app.services.storage_service import StorageError
from app.utils.tax import vat_on_top

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/credits", tags=["Credits"])


@router.get("/packs", response_model=list[CreditPackResponse])
async def list_packs(
    _session: SessionInfo = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
):
    """List active top-up packs, cheapest first."""
    rows = (
        (
            await db.execute(
                select(CreditPack)
                .where(CreditPack.is_active == True)  # noqa: E712
                .order_by(CreditPack.sort_order, CreditPack.credits)
            )
        )
        .scalars()
        .all()
    )
    return [CreditPackResponse.model_validate(p) for p in rows]


@router.get("/company-profile", response_model=CompanyProfileResponse)
async def get_company_profile(
    session: SessionInfo = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
):
    """
    Return prefilled buyer company info for the order form.
    Tries Carmen first (if configured), then falls back to the last invoice snapshot.
    """
    cfg = await bds._fetch_billing_configs(db)
    carmen_data = await carmen_service.get_company_profile(session.carmen_token, db_cfg=cfg)
    if carmen_data.get("name"):
        return CompanyProfileResponse(**carmen_data, source="carmen")

    last = await bds.get_last_buyer_info(db, session.tenant_id)
    if last.get("name"):
        return CompanyProfileResponse(**last, source="last_invoice")

    return CompanyProfileResponse(source="form")


@router.get("/payment-info", response_model=PaymentInfoResponse)
async def get_payment_info(
    _session: SessionInfo = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
):
    """Company pay-to details (bank transfer + cheque) printed on the proforma."""
    return PaymentInfoResponse(**await bds.get_payment_info(db))


@router.post("/orders", response_model=CreateOrderResponse)
async def create_order(
    body: CreateOrderRequest,
    session: SessionInfo = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a pending top-up order. Returns the PromptPay QR payload and a proforma invoice.
    Credits are NOT granted here — an admin approves the slip to fulfill.
    """
    # Block if tenant already has any open order (pending or under review)
    has_open = (
        await db.execute(
            select(CreditOrder.id)
            .where(
                CreditOrder.tenant_id == session.tenant_id,
                CreditOrder.status.in_(
                    [CreditOrderStatus.PENDING, CreditOrderStatus.AWAITING_REVIEW]
                ),
                CreditOrder.deleted_at.is_(None),
            )
            .limit(1)
        )
    ).scalar_one_or_none()
    if has_open:
        raise HTTPException(
            status_code=409,
            detail="You have an active order. Complete or cancel it first.",
        )

    pack = (
        await db.execute(select(CreditPack).where(CreditPack.code == body.pack_code))
    ).scalar_one_or_none()
    if pack is None or not pack.is_active:
        raise HTTPException(status_code=404, detail="Credit pack not found")

    # Subscription purchase guard (Option A): one active plan at a time — renew
    # only after the current cycle lapses. Top-ups bypass this. Switching to a
    # renew-while-active policy (B/C) is a localized change to this block + the
    # period math in credit_service.activate_subscription().
    if pack.kind == "subscription":
        current = await active_subscription(db, session.tenant_id)
        if current is not None:
            raise HTTPException(
                status_code=409,
                detail="You already have an active plan. You can renew after it ends.",
            )

    net = Decimal(str(pack.price_thb))
    _sub, _vat, gross = vat_on_top(net)
    order = CreditOrder(
        tenant_id=session.tenant_id,
        pack_code=pack.code,
        credits=pack.credits,
        amount_thb=gross,
        status=CreditOrderStatus.PENDING,
        expires_at=datetime.now(UTC) + timedelta(days=14),
    )
    try:
        db.add(order)
        await db.flush()  # get order.id before issuing the document
    except IntegrityError:
        # Lost a race against a concurrent create — the per-tenant open-order
        # unique index caught it. Same outcome as the pre-check above.
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="You have an active order. Complete or cancel it first.",
        )

    # Buyer info: body override → Carmen → last invoice → empty
    buyer_override = body.buyer
    if buyer_override and buyer_override.name:
        buyer = bds.BuyerInfo(
            name=buyer_override.name,
            tax_id=buyer_override.tax_id,
            address=buyer_override.address,
            branch=buyer_override.branch,
            email=buyer_override.email,
            contact_name=buyer_override.contact_name,
        )
    else:
        cfg = await bds._fetch_billing_configs(db)
        carmen_data = await carmen_service.get_company_profile(session.carmen_token, db_cfg=cfg)
        if carmen_data.get("name"):
            buyer = bds.BuyerInfo(**carmen_data)
        else:
            buyer = await bds.get_last_buyer_info(db, session.tenant_id)

    proforma = await bds.issue_document(
        db,
        tenant_id=session.tenant_id,
        order_id=str(order.id),
        doc_type=BillingDocumentType.PROFORMA,
        pack_code=pack.code,  # type: ignore[arg-type]
        pack_description=str(pack.description) if pack.description else f"{pack.credits} credits",
        credits=pack.credits,  # type: ignore[arg-type]
        amount_thb=Decimal(str(pack.price_thb)),
        buyer=buyer,
    )

    promptpay_id = await bds.get_promptpay_id(db)
    if not promptpay_id:
        logger.warning("billing.promptpay_id not configured — QR payload will be empty")

    total_incl = float(gross)
    qr_payload = promptpay_service.build_payload(promptpay_id, total_incl) if promptpay_id else ""

    await db.commit()
    await db.refresh(order)
    await db.refresh(proforma)

    return CreateOrderResponse(
        order=CreditOrderResponse.model_validate(order),
        qr=QrPayloadResponse(
            payload=qr_payload,
            amount_thb=total_incl,
            promptpay_id=promptpay_id,
        ),
        proforma=BillingDocumentResponse.model_validate(proforma),
    )


@router.post("/orders/{order_id}/slip", response_model=SlipUploadResponse)
async def upload_slip(
    order_id: str,
    file: UploadFile,
    session: SessionInfo = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a payment slip for a pending order. Moves status to awaiting_review.
    Accepted: JPG, PNG, PDF (max MAX_FILE_SIZE_MB).
    """
    order = (
        await db.execute(
            select(CreditOrder).where(
                CreditOrder.id == order_id,
                CreditOrder.tenant_id == session.tenant_id,
                CreditOrder.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()

    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != CreditOrderStatus.PENDING:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot upload slip for an order in status '{order.status}'",
        )

    # Validate file type and size (reuse existing file_service logic)
    # validate_and_read returns (bytes, filename); content_type comes from the upload header
    data, _ = await FileService.validate_and_read(file)
    content_type = file.content_type or "application/octet-stream"

    allowed = {"image/jpeg", "image/png", "application/pdf"}
    if content_type not in allowed:
        raise HTTPException(status_code=422, detail=f"Unsupported file type: {content_type}")

    try:
        key = await storage_service.upload_slip(
            tenant_id=session.tenant_id,
            order_id=order_id,
            data=data,
            content_type=content_type,
        )
    except StorageError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    order.slip_object_key = key  # type: ignore[assignment]
    order.slip_uploaded_at = datetime.now(UTC)  # type: ignore[assignment]
    order.status = CreditOrderStatus.AWAITING_REVIEW  # type: ignore[assignment]
    await db.commit()

    return SlipUploadResponse(order_id=order_id, status=order.status.value)


@router.post("/orders/{order_id}/cancel", response_model=CreditOrderResponse)
async def cancel_order(
    order_id: str,
    session: SessionInfo = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
):
    """
    Discard a pending or awaiting-review order. Uses FOR UPDATE to prevent
    race conditions with admin approve/reject.
    """
    order = (
        await db.execute(
            select(CreditOrder)
            .where(
                CreditOrder.id == order_id,
                CreditOrder.tenant_id == session.tenant_id,
                CreditOrder.deleted_at.is_(None),
            )
            .with_for_update()
        )
    ).scalar_one_or_none()

    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    _cancellable = {CreditOrderStatus.PENDING, CreditOrderStatus.AWAITING_REVIEW}
    if order.status not in _cancellable:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot cancel an order in status '{order.status}'",
        )

    order.status = CreditOrderStatus.CANCELLED  # type: ignore[assignment]
    order.deleted_at = datetime.now(UTC)  # type: ignore[assignment]
    await db.commit()
    await db.refresh(order)

    return CreditOrderResponse.model_validate(order)


@router.get("/orders", response_model=list[CreditOrderResponse])
async def list_orders(
    session: SessionInfo = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
):
    """List this tenant's credit orders, newest first."""
    rows = (
        (
            await db.execute(
                select(CreditOrder)
                .where(
                    CreditOrder.tenant_id == session.tenant_id,
                    CreditOrder.deleted_at.is_(None),
                )
                .order_by(CreditOrder.created_at.desc())
                .limit(100)
            )
        )
        .scalars()
        .all()
    )
    return [CreditOrderResponse.model_validate(r) for r in rows]


@router.get("/orders/{order_id}", response_model=CreditOrderResponse)
async def get_order(
    order_id: str,
    session: SessionInfo = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
):
    order = (
        await db.execute(
            select(CreditOrder).where(
                CreditOrder.id == order_id,
                CreditOrder.tenant_id == session.tenant_id,
                CreditOrder.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return CreditOrderResponse.model_validate(order)


@router.get("/orders/{order_id}/documents", response_model=list[BillingDocumentResponse])
async def list_order_documents(
    order_id: str,
    session: SessionInfo = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
):
    """Return all billing documents (proforma + tax invoice) for an order."""
    # Verify ownership
    order = (
        await db.execute(
            select(CreditOrder).where(
                CreditOrder.id == order_id,
                CreditOrder.tenant_id == session.tenant_id,
                CreditOrder.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

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
