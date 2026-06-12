"""Pydantic schemas for the top-up credit system."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CreditPackResponse(BaseModel):
    """A purchasable top-up pack in the catalog."""

    model_config = ConfigDict(from_attributes=True)

    code: str
    kind: str = "topup"  # 'subscription' (monthly tier) | 'topup' (one-time credits)
    credits: int
    price_thb: float
    sort_order: int = 0


class CreditOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    pack_code: str
    credits: int
    amount_thb: float
    status: str

    @field_validator("id", mode="before")
    @classmethod
    def _coerce_id(cls, v: object) -> str:
        return str(v)


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
    model_config = ConfigDict(from_attributes=True)

    id: str
    delta: int
    balance_after: int
    reason: str
    pack_code: str | None = None
    ref: str | None = None
    note: str | None = None
    created_at: str | None = None

    @field_validator("id", mode="before")
    @classmethod
    def _coerce_id(cls, v: object) -> str:
        return str(v)

    @field_validator("created_at", mode="before")
    @classmethod
    def _coerce_created_at(cls, v: object) -> object:
        return v.isoformat() if hasattr(v, "isoformat") else v


# ── Billing / QR payment ─────────────────────────────────────────────────────


class BuyerInfoInput(BaseModel):
    """Optional buyer company info supplied or edited by the user at order time."""

    name: str = ""
    tax_id: str = ""
    address: str = ""
    branch: str = ""


class CreateOrderRequest(BaseModel):
    pack_code: str
    buyer: BuyerInfoInput | None = None  # overrides Carmen prefill when provided


class QrPayloadResponse(BaseModel):
    """PromptPay dynamic QR payload string — render client-side as a QR image."""

    payload: str
    amount_thb: float
    promptpay_id: str


class BillingDocumentResponse(BaseModel):
    """Snapshot of a proforma or tax invoice for rendering/printing."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    doc_type: str
    number: str
    issue_date: datetime
    # Seller
    seller_name: str | None = None
    seller_tax_id: str | None = None
    seller_address: str | None = None
    seller_branch: str | None = None
    # Buyer
    buyer_name: str | None = None
    buyer_tax_id: str | None = None
    buyer_address: str | None = None
    buyer_branch: str | None = None
    # Line item
    pack_code: str
    description: str | None = None
    credits: int
    subtotal: Decimal
    vat_rate: Decimal
    vat_amount: Decimal
    total: Decimal
    currency: str = "THB"
    created_at: datetime | None = None

    @field_validator("id", mode="before")
    @classmethod
    def _coerce_id(cls, v: object) -> str:
        return str(v)


class CreateOrderResponse(BaseModel):
    """Full response for POST /credits/orders — order + QR + proforma."""

    order: "CreditOrderResponse"
    qr: QrPayloadResponse
    proforma: BillingDocumentResponse


class CompanyProfileResponse(BaseModel):
    """Prefilled buyer info from Carmen (or last-invoice fallback)."""

    name: str = ""
    tax_id: str = ""
    address: str = ""
    branch: str = ""
    source: str = "form"  # 'carmen' | 'last_invoice' | 'form'


class SlipUploadResponse(BaseModel):
    """Returned after a successful slip upload."""

    order_id: str
    status: str  # 'awaiting_review'


class RejectRequest(BaseModel):
    reason: str = Field(..., min_length=1, description="Reason shown to the tenant")
