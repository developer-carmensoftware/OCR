from enum import Enum


class TaskStatus(str, Enum):
    PENDING    = "pending"
    PROCESSING = "processing"
    COMPLETED  = "completed"
    FAILED     = "failed"


class BankType(str, Enum):
    BBL   = "BBL"
    KBANK = "KBANK"
    SCB   = "SCB"


class DocumentType(str, Enum):
    CREDIT_CARD = "CREDIT_CARD"
    AP_INVOICE  = "AP_INVOICE"


class AlertSeverity(str, Enum):
    INFO     = "info"
    WARN     = "warn"
    CRITICAL = "critical"


class JobStatus(str, Enum):
    RUNNING = "running"
    SUCCESS = "success"
    FAILED  = "failed"


# ── Control plane ────────────────────────────────────────────────────────────

class PromptType(str, Enum):
    OCR        = "ocr"
    MAPPING    = "mapping"
    CORRECTION = "correction"


class PromptStatus(str, Enum):
    DRAFT     = "draft"
    PUBLISHED = "published"
    ARCHIVED  = "archived"


class QuotaPeriod(str, Enum):
    DAILY   = "daily"
    MONTHLY = "monthly"
    YEARLY  = "yearly"


class QuotaMetric(str, Enum):
    CALLS     = "calls"
    TOKENS    = "tokens"
    COST_USD  = "cost_usd"
    DOCUMENTS = "documents"


class FieldName(str, Enum):
    date_processed = "date_processed"
    bank_name      = "bank_name"
    doc_name       = "doc_name"
    company_name   = "company_name"
    doc_date       = "doc_date"
    doc_no         = "doc_no"
    merchant_name  = "merchant_name"
    merchant_id    = "merchant_id"
    transaction    = "transaction"
    pay_amt        = "pay_amt"
    commis_amt     = "commis_amt"
    tax_amt        = "tax_amt"
    total          = "total"


class TenantPlan(str, Enum):
    FREE       = "free"
    PRO        = "pro"
    ENTERPRISE = "enterprise"
