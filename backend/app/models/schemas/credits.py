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
    description: str | None = None
    sort_order: int = 0


class CreditOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    pack_code: str
    credits: int
    amount_thb: float
    status: str
    # Surfaced for the admin slip-review queue; harmless on the tenant's own list.
    tenant_id: str | None = None
    tenant_name: str | None = None  # populated by the admin queue join only
    created_at: datetime | None = None
    slip_uploaded_at: datetime | None = None
    approved_at: datetime | None = None  # admin payment-approval timestamp
    approved_by: str | None = None  # admin email that approved (admin queue only)
    expires_at: datetime | None = None  # proforma valid-until (pending orders)
    rejected_reason: str | None = None  # reason shown to the buyer on rejection
    admin_note: str | None = None
    carmen_ar_posted_at: datetime | None = None
    carmen_ar_ref: str | None = None
    # Populated by the admin queue join only (proforma data + resolved AR code).
    proforma_number: str | None = None
    buyer_name: str | None = None
    carmen_ar_code: str | None = None

    @field_validator("id", "tenant_id", mode="before")
    @classmethod
    def _coerce_id(cls, v: object) -> object:
        return str(v) if v is not None else None


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
    email: str = ""
    contact_name: str = ""


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
    buyer_email: str | None = None
    buyer_contact_name: str | None = None
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


class PaymentInfoResponse(BaseModel):
    """Company-level pay-to details for the proforma (bank transfer + cheque)."""

    bank_name: str = ""
    bank_account_no: str = ""
    bank_account_name: str = ""
    bank_account_type: str = ""
    bank_branch: str = ""
    cheque_payee: str = ""
    seller_name_en: str = ""
    seller_phone: str = ""


class CompanyProfileResponse(BaseModel):
    """Prefilled buyer info from Carmen (or last-invoice fallback)."""

    name: str = ""
    tax_id: str = ""
    address: str = ""
    branch: str = ""
    email: str = ""
    contact_name: str = ""
    source: str = "form"  # 'carmen' | 'last_invoice' | 'form'


class SlipUploadResponse(BaseModel):
    """Returned after a successful slip upload."""

    order_id: str
    status: str  # 'in_progress'


class RejectRequest(BaseModel):
    reason: str = Field(..., min_length=1, description="Reason shown to the tenant")


class HoldRequest(BaseModel):
    """Update admin note on an in-progress order."""

    note: str | None = None


# ── AR Customer Profiles ────────────────────────────────────────────────────


class ArCustomerProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    buyer_name: str
    buyer_tax_id: str
    buyer_branch: str
    carmen_ar_code: str | None = None

    @field_validator("id", mode="before")
    @classmethod
    def _coerce_id(cls, v: object) -> str:
        return str(v)


class ArCustomerProfileUpdate(BaseModel):
    # ponytail: app-validated to 15 alphanumeric/hyphen (FRD); column stays VARCHAR(50), widen-safe.
    carmen_ar_code: str = Field(..., max_length=15, pattern=r"^[A-Za-z0-9-]*$")


class PostArRequest(BaseModel):
    order_ids: list[str] = Field(..., min_length=1)


class PostArResultItem(BaseModel):
    order_id: str
    success: bool
    carmen_ar_ref: str | None = None
    error: str | None = None


class PostArResponse(BaseModel):
    results: list[PostArResultItem]


class KpiSummaryResponse(BaseModel):
    unmapped_count: int  # mapping tab badge
    to_review_count: int  # verify tab badge
    to_post_count: int  # post tab badge
    # Funnel amounts (THB) — total_active = awaiting + to_review + to_post + posted (excl. void).
    total_amount: float
    awaiting_amount: float
    to_review_amount: float
    to_post_amount: float
    posted_amount: float
    rejected_amount: float
    status_counts: dict[str, int] = {}  # per-stage order counts for queue pills
