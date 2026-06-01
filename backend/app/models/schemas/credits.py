"""Pydantic schemas for the top-up credit system."""

from pydantic import BaseModel, Field


class CreditPackResponse(BaseModel):
    """A purchasable top-up pack in the catalog."""

    code: str
    credits: int
    price_thb: float
    sort_order: int = 0


class CreateOrderRequest(BaseModel):
    pack_code: str


class CreditOrderResponse(BaseModel):
    id: str
    pack_code: str
    credits: int
    amount_thb: float
    status: str


class TopupRequest(BaseModel):
    """Admin grants a pack's worth of credits to a tenant (offline-paid v1)."""

    pack_code: str
    order_id: str | None = None  # mark this pending order paid, if supplied


class AdjustRequest(BaseModel):
    """Admin manual credit correction (positive or negative)."""

    delta: int = Field(..., description="Credits to add (positive) or remove (negative)")
    note: str | None = None


class CreditBalanceResponse(BaseModel):
    tenant_id: str
    balance: int


class CreditLedgerEntry(BaseModel):
    id: str
    delta: int
    balance_after: int
    reason: str
    pack_code: str | None = None
    ref: str | None = None
    note: str | None = None
    created_at: str | None = None
