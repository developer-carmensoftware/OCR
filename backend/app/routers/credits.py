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
from app.services.credit_service import (
    active_subscription,
    annual_price,
    purchase_block_reason,
)
from app.services.file_service import FileService
from app.services.storage_service import StorageError
from app.utils.image_processing import resize_if_needed
from app.utils.tax import vat_on_top

# Slips only need to be legible (read the digits) — not archival quality. Downscale +
# JPEG re-encode before storing to keep the bucket small. Aggressive vs. the OCR path
# (2200/92) since no LLM reads these — a human just eyeballs the transfer amount.
_SLIP_MAX_DIMENSION = 1600
_SLIP_JPEG_QUALITY = 70

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/credits", tags=["Credits"])

# Orders still "open" and blocking a new purchase / acceptable for slip-upload
# or self-serve cancel. Mirrors the partial unique index in the DB.
_OPEN_STATUSES = (CreditOrderStatus.IN_PROGRESS, CreditOrderStatus.ON_HOLD)


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
    out: list[CreditPackResponse] = []
    for p in rows:
        resp = CreditPackResponse.model_validate(p)
        if p.kind == "subscription":
            resp.price_annual_thb = float(annual_price(str(p.price_thb)))
        out.append(resp)
    return out


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
    # Block if tenant already has any open order (in_progress or on_hold)
    has_open = (
        await db.execute(
            select(CreditOrder.id)
            .where(
                CreditOrder.tenant_id == session.tenant_id,
                CreditOrder.status.in_(_OPEN_STATUSES),
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

    # Upgrade guard: upgrade / renew allowed mid-plan; downgrade blocked.
    # ponytail: no proration credit — provider wants full price on every purchase.
    # credit_service.proration_credit() stays for an easy re-enable if that changes.
    if pack.kind == "subscription":
        current = await active_subscription(db, session.tenant_id)
        if current is not None:
            cur_pack = (
                await db.execute(select(CreditPack).where(CreditPack.code == current.plan_code))
            ).scalar_one()
            reason = purchase_block_reason(
                current.billing_period, cur_pack.credits, body.billing_period, pack.credits
            )
            if reason:
                raise HTTPException(status_code=409, detail=reason)

    # Annual = 12 months at a 10% discount; subscriptions only (top-ups never expire).
    is_annual = body.billing_period == "annual" and pack.kind == "subscription"
    billing_period = "annual" if is_annual else "monthly"
    net = annual_price(str(pack.price_thb)) if is_annual else Decimal(str(pack.price_thb))
    _sub, _vat, gross = vat_on_top(net)
    order = CreditOrder(
        tenant_id=session.tenant_id,
        pack_code=pack.code,
        credits=pack.credits,
        amount_thb=gross,
        billing_period=billing_period,
        proration_credit_thb=Decimal("0.00"),
        status=CreditOrderStatus.IN_PROGRESS,
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
            tel=buyer_override.tel,
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
        pack_description=(str(pack.description) if pack.description else f"{pack.credits} credits")
        + (" (Annual — 12 months)" if is_annual else ""),
        credits=pack.credits,  # type: ignore[arg-type]
        amount_thb=net,
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
    if order.status not in _OPEN_STATUSES:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot upload slip for an order in status '{order.status}'",
        )

    # Validate file type and size (reuse existing file_service logic)
    # validate_and_read returns (bytes, filename); content_type comes from the upload header
    # ponytail: storage upload then DB update isn't one atomic step — if the commit
    # below fails after a successful upload, the slip is orphaned in FileService.
    # FileService mints a new fileId per upload (no delete endpoint), so a re-upload
    # also leaks the prior file. Not lost data (the pointer tracks the newest); the
    # orphans are small and rare, accepted — no cleanup job.
    data, _ = await FileService.validate_and_read(file)
    content_type = file.content_type or "application/octet-stream"

    allowed = {"image/jpeg", "image/png", "application/pdf"}
    if content_type not in allowed:
        raise HTTPException(status_code=422, detail=f"Unsupported file type: {content_type}")

    # Compress images before storing (PDFs pass through untouched). Fall back to the
    # original bytes if re-encoding fails — a smaller slip is nice-to-have, never worth
    # dropping the upload over.
    if content_type in ("image/jpeg", "image/png"):
        try:
            data, content_type = resize_if_needed(
                data, max_dimension=_SLIP_MAX_DIMENSION, jpeg_quality=_SLIP_JPEG_QUALITY
            )
        except Exception:
            logger.warning("slip compression failed for order %s; storing original", order_id)

    # Store under the order's creation month (yyyymm), on the same UTC basis as the
    # proforma running number (PF-YYYYMM-NNNN) so slips file alongside their proforma.
    # Upload can happen a later month than creation, so use created_at, not now().
    path = (order.created_at or datetime.now(UTC)).astimezone(UTC).strftime("%Y%m")

    try:
        key = await storage_service.upload_slip(
            order_id=order_id,
            data=data,
            content_type=content_type,
            path=path,
        )
    except StorageError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    # Re-read the row under FOR UPDATE and re-check status before mutating. The
    # upload above is a slow network call during which an admin approve/reject
    # can flip the order to a decided state; without this lock+re-check the write
    # below would silently revert a PAID order to IN_PROGRESS, making it decidable
    # again and letting credits be granted twice. (cancel_order locks for the same
    # reason.) The lock is taken only after the upload, so it is held briefly.
    await db.refresh(order, with_for_update=True)
    if order.status not in _OPEN_STATUSES:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot upload slip for an order in status '{order.status}'",
        )

    order.slip_object_key = key  # type: ignore[assignment]
    order.slip_uploaded_at = datetime.now(UTC)  # type: ignore[assignment]
    # A slip arriving on a held order means the buyer engaged — put it back in
    # the normal review queue instead of the "needs contact" bucket.
    order.status = CreditOrderStatus.IN_PROGRESS  # type: ignore[assignment]
    await db.commit()

    return SlipUploadResponse(order_id=order_id, status=CreditOrderStatus.IN_PROGRESS.value)


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
    if order.status not in _OPEN_STATUSES:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot cancel an order in status '{order.status}'",
        )

    order.status = CreditOrderStatus.VOID  # type: ignore[assignment]
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
