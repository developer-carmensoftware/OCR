"""Pydantic schemas for the top-up credit system."""

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CreditPackResponse(BaseModel):
    """A purchasable top-up pack in the catalog."""

    model_config = ConfigDict(from_attributes=True)

    code: str
    credits: int
    price_thb: float
    sort_order: int = 0


class CreateOrderRequest(BaseModel):
    pack_code: str


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
