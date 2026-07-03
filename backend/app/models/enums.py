from enum import Enum


class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class DocumentType(str, Enum):
    CREDIT_CARD = "CREDIT_CARD"
    AP_INVOICE = "AP_INVOICE"


class AlertSeverity(str, Enum):
    INFO = "info"
    WARN = "warn"
    CRITICAL = "critical"


class JobStatus(str, Enum):
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"


# ── Control plane ────────────────────────────────────────────────────────────


class PromptType(str, Enum):
    OCR = "ocr"
    MAPPING = "mapping"
    CORRECTION = "correction"


class PromptStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class QuotaPeriod(str, Enum):
    DAILY = "daily"
    MONTHLY = "monthly"  # kept (disabled) — monthly reset rows still in DB
    YEARLY = "yearly"
    LIFETIME = "lifetime"  # free trial, never resets


class QuotaMetric(str, Enum):
    CALLS = "calls"
    TOKENS = "tokens"
    COST_USD = "cost_usd"
    DOCUMENTS = "documents"


class FieldName(str, Enum):
    date_processed = "date_processed"
    bank_name = "bank_name"
    doc_name = "doc_name"
    company_name = "company_name"
    doc_date = "doc_date"
    doc_no = "doc_no"
    merchant_name = "merchant_name"
    merchant_id = "merchant_id"
    transaction = "transaction"
    pay_amt = "pay_amt"
    commis_amt = "commis_amt"
    tax_amt = "tax_amt"
    total = "total"


class TenantPlan(str, Enum):
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class CreditLedgerReason(str, Enum):
    TOPUP = "topup"
    CONSUMPTION = "consumption"
    ADMIN_ADJUST = "admin_adjust"
    REFUND = "refund"


class CreditOrderStatus(str, Enum):
    IN_PROGRESS = "in_progress"
    PAID = "paid"
    COMPLETE = "complete"
    VOID = "void"
    # Auto-set by the hourly expiry sweep (fn_hold_expired_orders) when an
    # in_progress order's 14-day proforma window passes with no admin decision
    # yet — parks it for the quota admin to contact the buyer instead of
    # force-voiding it (buyer-side approval chains can outlast 14 days).
    ON_HOLD = "on_hold"


class BillingDocumentType(str, Enum):
    """Discriminator for billing_documents rows."""

    PROFORMA = "proforma"  # issued at order creation (request for payment)
    TAX_INVOICE = "tax_invoice"  # issued after admin approves payment (receipt / tax invoice)


class SubscriptionStatus(str, Enum):
    """Lifecycle of a tenant's monthly subscription window."""

    ACTIVE = "active"  # in-window, allowance consumable
    LAPSED = "lapsed"  # period ended (use-it-or-lose-it expired)
    SUPERSEDED = "superseded"  # replaced by a newer subscription
    # 'scheduled' (queued renewal, Option B) reserved — add via `alter type` when needed.
