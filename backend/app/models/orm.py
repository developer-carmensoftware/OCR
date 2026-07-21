"""
Backward-compatible re-export hub. All symbols still importable from app.models.orm.

New code should import directly from the domain modules:
  app.models.mixins       — TimestampMixin, SoftDeleteMixin, WriterMixin, TenantFKMixin
  app.models.identity     — Plan, Tenant
  app.models.admin        — AdminUser, Role, Permission, RolePermission, AdminUserRole, APIKey, APIKeyUsage
  app.models.catalog      — Module, TenantModule, Bank, PromptTemplate
  app.models.billing      — SystemConfig, TenantConfigOverride, FeatureFlag, Quota, QuotaUsage, LLMModelPricing,
                            CreditPack, TenantCredit, CreditLedger, CreditOrder, BillingDocument, DocumentSequence
  app.models.business     — OcrSession, OCRTask, CreditCard, APInvoice,
                            CorrectionFeedback, BUAccountingConfig,
                            BUAccountingMappingEntry, APVendorColumnMapping, APVendorFieldMappingEntry
  app.models.observability — LLMUsageLog, AuditLog, PerformanceLog, OutboundCallLog,
                             DailyUsageSummary, AnomalyAlert, JobRun
"""

from .admin import AdminUser, AdminUserRole, APIKey, APIKeyUsage, Permission, Role, RolePermission
from .billing import (
    ArCustomerProfile,
    BillingDocument,
    CreditLedger,
    CreditOrder,
    CreditPack,
    DocumentSequence,
    FeatureFlag,
    LLMModelPricing,
    Quota,
    QuotaUsage,
    SystemConfig,
    TenantConfigOverride,
    TenantCredit,
    TenantSubscription,
)
from .business import (
    APInvoice,
    APVendorColumnMapping,
    APVendorFieldMappingEntry,
    BUAccountingConfig,
    BUAccountingMappingEntry,
    CorrectionFeedback,
    CreditCard,
    OcrSession,
    OCRTask,
)
from .catalog import Bank, Module, PromptTemplate, TenantModule
from .enums import (
    AlertSeverity,
    JobStatus,
    PromptStatus,
    PromptType,
    QuotaMetric,
    QuotaPeriod,
    TaskStatus,
)
from .identity import Plan, Tenant
from .mixins import SoftDeleteMixin, TenantFKMixin, TimestampMixin, WriterMixin
from .observability import (
    AnomalyAlert,
    AuditLog,
    DailyModelCost,
    DailyUsageSummary,
    JobRun,
    LLMUsageLog,
    MonthlyUsageSummary,
    OutboundCallLog,
    PerformanceLog,
)

__all__ = [
    # Enums
    "AlertSeverity",
    "JobStatus",
    "PromptStatus",
    "PromptType",
    "QuotaMetric",
    "QuotaPeriod",
    "TaskStatus",
    # Mixins
    "TimestampMixin",
    "SoftDeleteMixin",
    "WriterMixin",
    "TenantFKMixin",
    # Identity
    "Plan",
    "Tenant",
    # Admin RBAC
    "AdminUser",
    "Role",
    "Permission",
    "RolePermission",
    "AdminUserRole",
    "APIKey",
    "APIKeyUsage",
    # Catalog
    "Module",
    "TenantModule",
    "Bank",
    "PromptTemplate",
    # Billing / Config
    "SystemConfig",
    "TenantConfigOverride",
    "FeatureFlag",
    "Quota",
    "QuotaUsage",
    "LLMModelPricing",
    "CreditPack",
    "TenantCredit",
    "CreditLedger",
    "CreditOrder",
    "ArCustomerProfile",
    "BillingDocument",
    "DocumentSequence",
    "TenantSubscription",
    # Business
    "OcrSession",
    "OCRTask",
    "CreditCard",
    "APInvoice",
    "CorrectionFeedback",
    "BUAccountingConfig",
    "BUAccountingMappingEntry",
    "APVendorColumnMapping",
    "APVendorFieldMappingEntry",
    # Observability
    "LLMUsageLog",
    "AuditLog",
    "PerformanceLog",
    "OutboundCallLog",
    "DailyUsageSummary",
    "DailyModelCost",
    "MonthlyUsageSummary",
    "AnomalyAlert",
    "JobRun",
]
