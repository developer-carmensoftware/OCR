"""Admin top-up credit management — balance, top-up, manual adjust, ledger."""

import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.admin_session import AdminPrincipal
from app.database import get_db
from app.models.enums import CreditLedgerReason, CreditOrderStatus
from app.models.orm import CreditLedger, CreditOrder, CreditPack
from app.models.schemas import (
    AdjustRequest,
    CreditBalanceResponse,
    CreditLedgerEntry,
    TopupRequest,
)
from app.services.credit_service import get_credit_balance, grant_credits

from .deps import require_permission

logger = logging.getLogger(__name__)
router = APIRouter()


def _assert_scope(admin: AdminPrincipal, tenant_id: str) -> None:
    """Scoped admins may only act on their own tenant."""
    if not admin.is_global and str(admin.tenant_scope) != str(tenant_id):
        raise HTTPException(status_code=403, detail="Tenant out of scope")


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
        if order is None or str(order.tenant_id) != str(tenant_id):
            raise HTTPException(status_code=404, detail="Order not found")
        if order.status == CreditOrderStatus.PAID:
            raise HTTPException(status_code=409, detail="Order already fulfilled")
        order.status = CreditOrderStatus.PAID
        order.paid_at = datetime.now(UTC).replace(tzinfo=None)
        order.approved_by = admin.email
        order.approved_at = datetime.now(UTC).replace(tzinfo=None)
        order_ref = str(order.id)

    balance = await grant_credits(
        db,
        tenant_id,
        pack.credits,
        reason=CreditLedgerReason.TOPUP,
        pack_code=pack.code,
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
    return [
        CreditLedgerEntry(
            id=str(r.id),
            delta=r.delta,
            balance_after=r.balance_after,
            reason=r.reason,
            pack_code=r.pack_code,
            ref=r.ref,
            note=r.note,
            created_at=r.created_at.isoformat() if r.created_at else None,
        )
        for r in rows
    ]
