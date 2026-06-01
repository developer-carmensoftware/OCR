"""
Tenant-facing top-up credit endpoints.

  GET  /api/v1/credits/packs   — purchasable pack catalog (for the top-up UI)
  POST /api/v1/credits/orders  — create a pending order (payment-gateway groundwork)

Fulfillment in v1 is manual: an admin marks the order paid and grants the
credits (see app/routers/admin/credits.py). No payment gateway is wired yet.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import SessionInfo, get_current_session
from app.database import get_db
from app.models.orm import CreditOrder, CreditPack
from app.models.schemas import (
    CreateOrderRequest,
    CreditOrderResponse,
    CreditPackResponse,
)

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
    return [
        CreditPackResponse(
            code=p.code,
            credits=p.credits,
            price_thb=float(p.price_thb),
            sort_order=p.sort_order,
        )
        for p in rows
    ]


@router.post("/orders", response_model=CreditOrderResponse)
async def create_order(
    body: CreateOrderRequest,
    session: SessionInfo = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a pending top-up order for the current tenant. Credits are NOT granted
    here — an admin (or a future payment webhook) marks the order paid to fulfill.
    """
    pack = (
        await db.execute(select(CreditPack).where(CreditPack.code == body.pack_code))
    ).scalar_one_or_none()
    if pack is None or not pack.is_active:
        raise HTTPException(status_code=404, detail="Credit pack not found")

    order = CreditOrder(
        tenant_id=session.tenant_id,
        pack_code=pack.code,
        credits=pack.credits,
        amount_thb=pack.price_thb,
        status="pending",
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)

    return CreditOrderResponse(
        id=str(order.id),
        pack_code=order.pack_code,
        credits=order.credits,
        amount_thb=float(order.amount_thb),
        status=order.status,
    )
