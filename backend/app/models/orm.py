"""
ORM models for the carmen_ai database.

Two-plane architecture:
  DATA PLANE    — OCR/AP processes write here; all rows scoped to tenant + business_unit.
  CONTROL PLANE — Admin dashboard manages here; global configuration, no per-row tenant scope.

Mixin guide:
  TenantFKMixin   — tenant_id + business_unit_id as FK (NOT NULL) for business data tables.
  TimestampMixin  — created_at (indexed) + updated_at on every table.
  SoftDeleteMixin — deleted_at + deleted_by; business tables never hard-delete.
  WriterMixin     — created_by + updated_by as VARCHAR(100):
                    • Control plane → stores admin_user_id (UUID from admin_users)
                    • Data plane    → stores carmen_user_id (UUID from Carmen ERP)

Partitioned tables (LLMUsageLog, AuditLog, PerformanceLog, OutboundCallLog):
  MariaDB does not allow FK constraints on partitioned tables.
  tenant_id / business_unit_id on these tables are plain VARCHAR(36) + index.
  Application layer enforces referential integrity.
"""

import uuid

from sqlalchemy import (
    JSON, BigInteger, Boolean, Column, Float, Integer,
    ForeignKey, Numeric, String, DateTime, Text, UniqueConstraint,
    event,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base
from .enums import (
    AlertSeverity, JobStatus, PromptStatus, PromptType,
    QuotaMetric, QuotaPeriod, TaskStatus, TenantPlan,
)


# ══════════════════════════════════════════════════════════════════════════════
# MIXINS
# ══════════════════════════════════════════════════════════════════════════════

class TimestampMixin:
    """created_at (indexed) + updated_at. Applied to every table."""
    created_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class SoftDeleteMixin:
    """Logical deletion. Business tables never physically remove rows."""
    deleted_at = Column(DateTime, nullable=True, index=True)
    deleted_by = Column(String(100), nullable=True)


class WriterMixin:
    """Who created / last-modified a row. See module docstring for value format."""
    created_by = Column(String(100), nullable=True, index=True)
    updated_by = Column(String(100), nullable=True)


class TenantFKMixin:
    """
    Proper FK-based tenancy for business data tables.
    Both columns are NOT NULL — every business row belongs to a specific tenant + BU.
    """
    tenant_id        = Column(String(36), ForeignKey("tenants.id"),        nullable=False, index=True)
    business_unit_id = Column(String(36), ForeignKey("business_units.id"), nullable=False, index=True)


# ══════════════════════════════════════════════════════════════════════════════
# CONTROL PLANE — Identity & Multi-tenancy
# ══════════════════════════════════════════════════════════════════════════════

class Tenant(Base, TimestampMixin, SoftDeleteMixin, WriterMixin):
    """
    One row per Carmen ERP customer (company).
    The `host` column is the hostname of their Carmen instance and is the lookup key
    used when resolving incoming requests (extracted from JWT / X-Carmen-URI header).
    """
    __tablename__ = "tenants"

    id            = Column(String(36),  primary_key=True, default=lambda: str(uuid.uuid4()))
    host          = Column(String(255), nullable=False, unique=True, index=True)
    name          = Column(String(255), nullable=False)
    plan          = Column(SAEnum(TenantPlan, values_callable=lambda o: [e.value for e in o]),
                           default=TenantPlan.FREE, nullable=False)
    is_active     = Column(Boolean,     default=True, nullable=False)
    contact_email = Column(String(255), nullable=True)
    notes         = Column(Text,        nullable=True)

    business_units = relationship("BusinessUnit", back_populates="tenant")


class BusinessUnit(Base, TimestampMixin, SoftDeleteMixin, WriterMixin):
    """
    A department / branch within a Tenant.
    The `code` comes from the Carmen JWT claim `bu` and is used as the lookup key.
    Unique per tenant: the same BU code may exist under different tenants.
    """
    __tablename__ = "business_units"

    id        = Column(String(36),  primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36),  ForeignKey("tenants.id"), nullable=False, index=True)
    code      = Column(String(100), nullable=False)
    name      = Column(String(255), nullable=False)
    is_active = Column(Boolean,     default=True, nullable=False)

    tenant = relationship("Tenant", back_populates="business_units")

    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_bu_tenant_code"),
    )


# ── Admin RBAC ────────────────────────────────────────────────────────────────

class AdminUser(Base, TimestampMixin, SoftDeleteMixin, WriterMixin):
    """
    Hub admin staff. Completely separate from Carmen ERP end-users.
    First super_admin must be created via the bootstrap CLI — never seeded in migrations.
    """
    __tablename__ = "admin_users"

    id                    = Column(String(36),  primary_key=True, default=lambda: str(uuid.uuid4()))
    email                 = Column(String(255), nullable=False, unique=True)
    password_hash         = Column(String(255), nullable=False)
    full_name             = Column(String(255), nullable=True)
    is_active             = Column(Boolean,     default=True,  nullable=False)
    mfa_secret            = Column(String(64),  nullable=True)
    last_login_at         = Column(DateTime,    nullable=True)
    last_login_ip         = Column(String(45),  nullable=True)
    failed_login_attempts = Column(Integer,     default=0, nullable=False)
    locked_until          = Column(DateTime,    nullable=True)


class Role(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "roles"

    id          = Column(String(50),  primary_key=True)
    name        = Column(String(100), nullable=False)
    description = Column(Text,        nullable=True)
    is_system   = Column(Boolean,     default=False, nullable=False)


class Permission(Base, TimestampMixin):
    """id format: '{resource}:{action}' e.g. 'banks:write'"""
    __tablename__ = "permissions"

    id          = Column(String(100), primary_key=True)
    name        = Column(String(255), nullable=False)
    resource    = Column(String(50),  nullable=False, index=True)
    action      = Column(String(50),  nullable=False)
    description = Column(Text,        nullable=True)


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id       = Column(String(50),  ForeignKey("roles.id"),       primary_key=True)
    permission_id = Column(String(100), ForeignKey("permissions.id"), primary_key=True)


class AdminUserRole(Base, TimestampMixin):
    """
    Assigns a role to an admin user, optionally scoped to one tenant.
    tenant_id = '' (empty string, default) means the role is global (all tenants).
    """
    __tablename__ = "admin_user_roles"

    user_id    = Column(String(36), ForeignKey("admin_users.id"), primary_key=True)
    role_id    = Column(String(50), ForeignKey("roles.id"),       primary_key=True)
    tenant_id  = Column(String(36), ForeignKey("tenants.id"),     primary_key=True, default="")
    granted_by = Column(String(36), nullable=True)
    expires_at = Column(DateTime,   nullable=True)


# ── API Keys ──────────────────────────────────────────────────────────────────

class APIKey(Base, TimestampMixin, WriterMixin):
    """
    API key for external system auth.
    Plaintext key shown ONCE at creation; DB stores only the hash.
    Revocation: set revoked_at — rows are never deleted so revocation is auditable.
    """
    __tablename__ = "api_keys"

    id             = Column(String(36),  primary_key=True, default=lambda: str(uuid.uuid4()))
    name           = Column(String(100), nullable=False)
    key_prefix     = Column(String(12),  nullable=False, index=True)
    key_hash       = Column(String(255), nullable=False, unique=True)
    tenant_id      = Column(String(36),  ForeignKey("tenants.id"), nullable=True, index=True)
    scopes         = Column(JSON,        nullable=False)
    rate_limit_rpm = Column(Integer,     default=60, nullable=False)
    expires_at     = Column(DateTime,    nullable=True, index=True)
    last_used_at   = Column(DateTime,    nullable=True)
    last_used_ip   = Column(String(45),  nullable=True)
    revoked_at     = Column(DateTime,    nullable=True, index=True)
    revoked_by     = Column(String(36),  nullable=True)
    revoke_reason  = Column(Text,        nullable=True)


class APIKeyUsage(Base, TimestampMixin):
    """Daily aggregate of API key usage for dashboard charts."""
    __tablename__ = "api_key_usage"

    api_key_id = Column(String(36), ForeignKey("api_keys.id"), primary_key=True)
    usage_date = Column(DateTime,   primary_key=True)
    calls      = Column(Integer,    default=0, nullable=False)
    errors     = Column(Integer,    default=0, nullable=False)
    tokens     = Column(BigInteger, default=0, nullable=False)
    cost_usd   = Column(Numeric(12, 4), default=0, nullable=False)


# ── Module Registry ───────────────────────────────────────────────────────────

class Module(Base, TimestampMixin):
    """
    Hub module catalog. Adding a module = INSERT row; no schema or code change required.
    module id is a natural key (e.g. 'credit_card_ocr') used as FK in many tables.
    """
    __tablename__ = "modules"

    id           = Column(String(50),  primary_key=True)
    display_name = Column(String(100), nullable=False)
    description  = Column(Text,        nullable=True)
    is_active    = Column(Boolean,     default=True, nullable=False)
    sort_order   = Column(Integer,     default=0)


class TenantModule(Base, TimestampMixin, WriterMixin):
    """Which modules each tenant has enabled."""
    __tablename__ = "tenant_modules"

    tenant_id   = Column(String(36), ForeignKey("tenants.id"),  primary_key=True)
    module_id   = Column(String(50), ForeignKey("modules.id"),  primary_key=True)
    enabled     = Column(Boolean,    default=True, nullable=False)
    enabled_at  = Column(DateTime,   nullable=True)
    disabled_at = Column(DateTime,   nullable=True)


# ── Bank CMS ──────────────────────────────────────────────────────────────────

class Bank(Base, TimestampMixin, SoftDeleteMixin, WriterMixin):
    """
    Bank registry. Replaces the old hardcoded BankType enum.
    `detection_pattern` is a regex matched against company_name from LLM output.
    Adding a bank = INSERT row + create prompt via dashboard; zero redeploy.
    """
    __tablename__ = "banks"

    code              = Column(String(20),  primary_key=True)
    name              = Column(String(100), nullable=False)
    display_name_th   = Column(String(100), nullable=True)
    is_active         = Column(Boolean,     default=True, nullable=False)
    detection_pattern = Column(String(500), nullable=True)
    sort_order        = Column(Integer,     default=0)
    icon_url          = Column(String(500), nullable=True)


class PromptTemplate(Base, TimestampMixin, SoftDeleteMixin, WriterMixin):
    """
    Versioned OCR/mapping/correction prompts managed via admin dashboard.
    Lifecycle: draft → published → archived.
    Only ONE published version per (bank_code, prompt_type) is active at a time.
    bank_code = NULL means a generic / combined prompt (used when bank is unknown).
    """
    __tablename__ = "prompt_templates"

    id           = Column(String(36),  primary_key=True, default=lambda: str(uuid.uuid4()))
    bank_code    = Column(String(20),  ForeignKey("banks.code"), nullable=True, index=True)
    prompt_type  = Column(SAEnum(PromptType,   values_callable=lambda o: [e.value for e in o]), nullable=False)
    version      = Column(Integer,     nullable=False)
    status       = Column(SAEnum(PromptStatus, values_callable=lambda o: [e.value for e in o]),
                          default=PromptStatus.DRAFT, nullable=False, index=True)
    content      = Column(Text,        nullable=False)
    notes        = Column(Text,        nullable=True)
    published_at = Column(DateTime,    nullable=True)
    published_by = Column(String(36),  ForeignKey("admin_users.id"), nullable=True)

    __table_args__ = (
        UniqueConstraint("bank_code", "prompt_type", "version",
                         name="uq_prompt_bank_type_version"),
    )


# ── System Configuration ──────────────────────────────────────────────────────

class SystemConfig(Base, TimestampMixin, WriterMixin):
    """
    Global key-value configuration (DB-driven settings).
    Secrets (JWT key, encryption key, DB URL) MUST stay in .env — never enter DB.
    """
    __tablename__ = "system_configs"

    key_name         = Column(String(100), primary_key=True)
    value            = Column(JSON,        nullable=False)
    value_type       = Column(String(20),  nullable=False)
    category         = Column(String(50),  nullable=False, index=True)
    description      = Column(Text,        nullable=True)
    is_secret        = Column(Boolean,     default=False, nullable=False)
    requires_restart = Column(Boolean,     default=False, nullable=False)
    default_value    = Column(JSON,        nullable=True)
    validation_regex = Column(String(500), nullable=True)


class TenantConfigOverride(Base, TimestampMixin, WriterMixin):
    """Per-tenant override of a system_configs entry. Lookup: tenant_override → global → default."""
    __tablename__ = "tenant_config_overrides"

    tenant_id = Column(String(36),  ForeignKey("tenants.id"),              primary_key=True)
    key_name  = Column(String(100), ForeignKey("system_configs.key_name"), primary_key=True)
    value     = Column(JSON,        nullable=False)


class FeatureFlag(Base, TimestampMixin, WriterMixin):
    """
    Boolean feature toggles with per-tenant override and gradual rollout.
    enabled_tenants: JSON array of tenant_ids that override enabled_global.
    rollout_pct: 0-100 — used when enabled_global=True to gradually roll out.
    """
    __tablename__ = "feature_flags"

    flag_key        = Column(String(100), primary_key=True)
    description     = Column(Text,        nullable=True)
    enabled_global  = Column(Boolean,     default=False, nullable=False)
    enabled_tenants = Column(JSON,        nullable=True)
    rollout_pct     = Column(Integer,     default=0,     nullable=False)


# ── Quota Engine ──────────────────────────────────────────────────────────────

class Quota(Base, TimestampMixin, SoftDeleteMixin, WriterMixin):
    """
    Quota rule per tenant — shared pool across ALL modules.
    is_hard = True → block at limit; False → warn only.
    """
    __tablename__ = "quotas"

    id            = Column(String(36),  primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id     = Column(String(36),  ForeignKey("tenants.id"), nullable=False, index=True)
    period        = Column(SAEnum(QuotaPeriod, values_callable=lambda o: [e.value for e in o]), nullable=False)
    metric        = Column(SAEnum(QuotaMetric, values_callable=lambda o: [e.value for e in o]), nullable=False)
    limit_value   = Column(Numeric(18, 4), nullable=False)
    soft_warn_pct = Column(Numeric(3,  2), default=0.80, nullable=False)
    is_hard       = Column(Boolean,        default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("tenant_id", "period", "metric",
                         name="uq_quota_tenant_period_metric"),
    )


class QuotaUsage(Base, TimestampMixin):
    """
    Running counter incremented in real-time.
    period_key format: '2026-05' (monthly) | '2026-05-14' (daily)
    """
    __tablename__ = "quota_usage"

    quota_id        = Column(String(36), ForeignKey("quotas.id"), primary_key=True)
    period_key      = Column(String(10), primary_key=True)
    used            = Column(Numeric(18, 4), default=0, nullable=False)
    last_updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


# ── LLM Pricing ───────────────────────────────────────────────────────────────

class LLMModelPricing(Base, TimestampMixin):
    """LLM model pricing synced from OpenRouter API every 8h."""
    __tablename__ = "model_pricing"

    model_name          = Column(String(255),    primary_key=True)
    input_price_per_1m  = Column(Numeric(18, 9), default=0)
    output_price_per_1m = Column(Numeric(18, 9), default=0)
    source              = Column(String(50),     default="manual")
    price_verified_at   = Column(DateTime,       nullable=True)


# ══════════════════════════════════════════════════════════════════════════════
# DATA PLANE — Business Tables
# All use TenantFKMixin: tenant_id + business_unit_id are NOT NULL FKs.
# SoftDeleteMixin: rows are never physically deleted.
# WriterMixin.created_by: stores carmen_user_id (the Carmen ERP user who acted).
# ══════════════════════════════════════════════════════════════════════════════

class OcrSession(Base, TenantFKMixin, TimestampMixin, SoftDeleteMixin):
    """
    Active session for a Carmen ERP user.
    carmen_token_encrypted: Fernet-encrypted Carmen API token, decrypted per-request.
    Session invalidation: is_active=False (set on Carmen 401) or JWT exp.
    """
    __tablename__ = "ocr_sessions"

    id                     = Column(String(36),  primary_key=True, default=lambda: str(uuid.uuid4()))
    carmen_user_id         = Column(String(36),  nullable=True, index=True)
    username               = Column(String(100), nullable=True)
    carmen_token_encrypted = Column(Text,        nullable=False)
    carmen_uri             = Column(String(500), nullable=True)
    is_active              = Column(Boolean,     default=True, nullable=False)
    last_used_at           = Column(DateTime,    nullable=True)


class OCRTask(Base, TenantFKMixin, TimestampMixin, SoftDeleteMixin):
    """
    Job record for every OCR upload. Parent of CreditCard and APInvoice.
    module_id: which module processed this task (FK to modules).
    """
    __tablename__ = "ocr_tasks"

    id                = Column(String(36),  primary_key=True, default=lambda: str(uuid.uuid4()))
    module_id         = Column(String(50),  ForeignKey("modules.id"), nullable=False, index=True)
    original_filename = Column(String(255), nullable=False)
    status            = Column(SAEnum(TaskStatus, values_callable=lambda o: [e.value for e in o]),
                               default=TaskStatus.PENDING, nullable=False)
    ocr_engine        = Column(String(100), nullable=True)
    error_message     = Column(Text,        nullable=True)
    completed_at      = Column(DateTime,    nullable=True)
    carmen_user_id    = Column(String(36),  nullable=True, index=True)

    credit_card = relationship("CreditCard", back_populates="task", uselist=False)
    ap_invoice  = relationship("APInvoice",  back_populates="task", uselist=False)


class CreditCard(Base, TenantFKMixin, TimestampMixin, SoftDeleteMixin, WriterMixin):
    """
    Extracted data from a credit card bank statement.
    bank_code: FK to banks.code (replaces the old hardcoded BankType enum).
    Transactions are stored in CreditCardTransaction (not JSON).
    submitted_at: NULL = draft; NOT NULL = submitted to Carmen ERP.
    Duplicate check: (tenant_id, business_unit_id, bank_code, doc_no, submitted_at IS NOT NULL).
    """
    __tablename__ = "credit_cards"

    id                = Column(String(36),  primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id           = Column(String(36),  ForeignKey("ocr_tasks.id"), nullable=False, index=True)
    bank_code         = Column(String(20),  ForeignKey("banks.code"),   nullable=True, index=True)
    company_name      = Column(String(255), nullable=True)
    bank_company_name = Column(String(255), nullable=True)
    doc_date          = Column(String(50),  nullable=True)
    doc_no            = Column(String(100), nullable=True, index=True)
    branch_no         = Column(String(50),  nullable=True)
    submitted_at      = Column(DateTime,    nullable=True)
    carmen_user_id    = Column(String(36),  nullable=True, index=True)

    task         = relationship("OCRTask", back_populates="credit_card")
    transactions = relationship("CreditCardTransaction", back_populates="credit_card",
                                cascade="all, delete-orphan", order_by="CreditCardTransaction.sort_order")


class CreditCardTransaction(Base, TimestampMixin, SoftDeleteMixin):
    """
    Individual line item from a credit card statement.
    Replaces the old JSON `transactions` blob on CreditCard.
    sort_order preserves the original order from the LLM output.
    """
    __tablename__ = "credit_card_transactions"

    id             = Column(String(36),  primary_key=True, default=lambda: str(uuid.uuid4()))
    credit_card_id = Column(String(36),  ForeignKey("credit_cards.id"), nullable=False, index=True)
    tx_date        = Column(String(50),  nullable=True)
    description    = Column(Text,        nullable=True)
    amount         = Column(Numeric(18, 4), nullable=True)
    tx_type        = Column(String(50),  nullable=True)
    sort_order     = Column(Integer,     default=0, nullable=False)

    credit_card = relationship("CreditCard", back_populates="transactions")


class APInvoice(Base, TenantFKMixin, TimestampMixin, SoftDeleteMixin, WriterMixin):
    """
    Metadata for an AP Invoice OCR job.
    Line items are NOT stored (extract-display-only pattern) — Carmen ERP is source of truth.
    """
    __tablename__ = "ap_invoices"

    id                = Column(String(36),  primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id           = Column(String(36),  ForeignKey("ocr_tasks.id"), nullable=False, index=True)
    vendor_name       = Column(String(255), nullable=True)
    doc_no            = Column(String(100), nullable=True)
    doc_date          = Column(String(50),  nullable=True)
    original_filename = Column(String(255), nullable=True)
    submitted_at      = Column(DateTime,    nullable=True)
    carmen_user_id    = Column(String(36),  nullable=True, index=True)

    task = relationship("OCRTask", back_populates="ap_invoice")


class MappingHistory(Base, TenantFKMixin, TimestampMixin, SoftDeleteMixin, WriterMixin):
    """
    GL mapping learning: which dept/account code was confirmed for a field type + bank.
    confirmed_count is incremented each time a user confirms the same mapping.
    """
    __tablename__ = "mapping_history"

    id              = Column(Integer,     primary_key=True, autoincrement=True)
    bank_code       = Column(String(20),  ForeignKey("banks.code"), nullable=False, index=True)
    field_type      = Column(String(100), nullable=False)
    dept_code       = Column(String(100), nullable=True)
    acc_code        = Column(String(100), nullable=True)
    confirmed_count = Column(Integer,     default=1, nullable=False)

    __table_args__ = (
        UniqueConstraint("tenant_id", "business_unit_id", "bank_code", "field_type",
                         "dept_code", "acc_code",
                         name="uq_mapping_scope_bank_field_choice"),
    )


class CorrectionFeedback(Base, TenantFKMixin, TimestampMixin, SoftDeleteMixin, WriterMixin):
    """
    User correction of an LLM-extracted field.
    Used by correction_service to compute per-field error rates and inject prompt hints.
    Unique per (scope, doc_no, field_name) — latest correction wins.
    """
    __tablename__ = "correction_feedback"

    id              = Column(Integer,     primary_key=True, autoincrement=True)
    doc_no          = Column(String(100), nullable=False, index=True)
    bank_code       = Column(String(20),  ForeignKey("banks.code"), nullable=False, index=True)
    field_name      = Column(String(100), nullable=False, index=True)
    original_value  = Column(Text,        nullable=True)
    corrected_value = Column(Text,        nullable=True)
    carmen_user_id  = Column(String(36),  nullable=True, index=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "business_unit_id", "doc_no", "field_name",
                         name="uq_correction_scope_doc_field"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# OBSERVABILITY — Partitioned log tables (quarterly, by created_at)
#
# FK constraints are NOT used on these tables because MariaDB does not support
# foreign key constraints on partitioned tables. tenant_id / business_unit_id
# are stored as plain VARCHAR(36) with indexes. Integrity is enforced by the
# application layer (auth middleware sets context; services read from context).
# ══════════════════════════════════════════════════════════════════════════════

class LLMUsageLog(Base, TimestampMixin):
    """
    One row per LLM API call. Append-only, no soft delete.
    module_id: replaces the old free-text usage_type string — FK to modules at app level.
    cost_usd: estimated from model_pricing table at insert time.
    Partitioned: quarterly by created_at.
    """
    __tablename__ = "llm_usage_logs"

    id                = Column(BigInteger,    primary_key=True, autoincrement=True)
    tenant_id         = Column(String(36),    nullable=False, index=True)
    business_unit_id  = Column(String(36),    nullable=True,  index=True)
    task_id           = Column(String(36),    nullable=True,  index=True)
    module_id         = Column(String(50),    nullable=True,  index=True)
    carmen_session_id = Column(String(36),    nullable=True,  index=True)
    carmen_user_id    = Column(String(36),    nullable=True,  index=True)
    model             = Column(String(100),   nullable=False)
    prompt_tokens     = Column(Integer,       default=0)
    completion_tokens = Column(Integer,       default=0)
    total_tokens      = Column(Integer,       default=0)
    duration_ms       = Column(Float,         nullable=True)
    cost_usd          = Column(Numeric(10, 6), nullable=True)


class AuditLog(Base, TimestampMixin):
    """
    Immutable event log. Append-only, no soft delete.
    Either admin_user_id OR carmen_user_id is set (never both, never neither).
    Control-plane changes include before_value / after_value JSON for diffs.
    Partitioned: quarterly by created_at.
    """
    __tablename__ = "audit_logs"

    id               = Column(BigInteger,   primary_key=True, autoincrement=True)
    tenant_id        = Column(String(36),   nullable=True,  index=True)
    business_unit_id = Column(String(36),   nullable=True,  index=True)
    # Who performed the action
    admin_user_id    = Column(String(36),   nullable=True,  index=True)
    carmen_user_id   = Column(String(36),   nullable=True,  index=True)
    username         = Column(String(100),  nullable=True)
    session_id       = Column(String(36),   nullable=True,  index=True)
    ip_address       = Column(String(45),   nullable=True)
    # What was done
    action           = Column(String(50),   nullable=False, index=True)
    resource         = Column(String(50),   nullable=True,  index=True)
    resource_id      = Column(String(255),  nullable=True,  index=True)
    # Control-plane diff (set only for admin config changes)
    target_type      = Column(String(50),   nullable=True,  index=True)
    target_id        = Column(String(100),  nullable=True)
    before_value     = Column(JSON,         nullable=True)
    after_value      = Column(JSON,         nullable=True)


class PerformanceLog(Base, TimestampMixin):
    """
    HTTP request latency — one row per request via PerformanceMiddleware.
    Partitioned: quarterly by created_at.
    """
    __tablename__ = "performance_logs"

    id               = Column(BigInteger,   primary_key=True, autoincrement=True)
    tenant_id        = Column(String(36),   nullable=True, index=True)
    business_unit_id = Column(String(36),   nullable=True, index=True)
    endpoint         = Column(String(200),  nullable=False, index=True)
    method           = Column(String(10),   nullable=True)
    duration_ms      = Column(Float,        nullable=False)
    status_code      = Column(Integer,      nullable=True)
    carmen_user_id   = Column(String(36),   nullable=True, index=True)
    resource_id      = Column(String(255),  nullable=True)


class OutboundCallLog(Base, TimestampMixin):
    """
    Every HTTP call made to external services (Carmen ERP, OpenRouter, etc.).
    Partitioned: quarterly by created_at.
    """
    __tablename__ = "outbound_call_logs"

    id                 = Column(BigInteger,  primary_key=True, autoincrement=True)
    tenant_id          = Column(String(36),  nullable=True, index=True)
    business_unit_id   = Column(String(36),  nullable=True, index=True)
    service            = Column(String(50),  nullable=False, index=True)
    url                = Column(String(500), nullable=False)
    method             = Column(String(10),  nullable=True)
    status_code        = Column(Integer,     nullable=True)
    duration_ms        = Column(Float,       nullable=True)
    request_size_bytes = Column(Integer,     nullable=True)
    session_id         = Column(String(36),  nullable=True, index=True)
    carmen_user_id     = Column(String(36),  nullable=True)


# ══════════════════════════════════════════════════════════════════════════════
# ANALYTICS
# ══════════════════════════════════════════════════════════════════════════════

class DailyUsageSummary(Base, TimestampMixin):
    """
    Pre-aggregated daily metrics. Built by summary_service.py nightly.
    Unique per (tenant, bu, module, date) — allows per-module cost breakdown.
    """
    __tablename__ = "daily_usage_summary"

    id                   = Column(Integer,       primary_key=True, autoincrement=True)
    tenant_id            = Column(String(36),    nullable=False, index=True)
    business_unit_id     = Column(String(36),    nullable=True,  index=True)
    module_id            = Column(String(50),    nullable=True,  index=True)
    summary_date         = Column(DateTime,      nullable=False, index=True)
    total_documents      = Column(Integer,       default=0)
    total_submissions    = Column(Integer,       default=0)
    total_llm_calls      = Column(Integer,       default=0)
    total_tokens         = Column(BigInteger,    default=0)
    total_cost_usd       = Column(Numeric(12, 4), default=0)
    avg_llm_latency_ms   = Column(Float,         default=0)
    total_api_calls      = Column(Integer,       default=0)
    avg_api_latency_ms   = Column(Float,         default=0)
    p95_api_latency_ms   = Column(Float,         default=0)
    total_errors         = Column(Integer,       default=0)
    total_corrections    = Column(Integer,       default=0)
    total_outbound_calls = Column(Integer,       default=0)

    __table_args__ = (
        UniqueConstraint("tenant_id", "business_unit_id", "module_id", "summary_date",
                         name="uq_summary_scope_module_date"),
    )


class AnomalyAlert(Base, TimestampMixin):
    """
    Anomaly detected by anomaly_service.py nightly.
    resolved_at = NULL means still open. Duplicate check: one open alert per (tenant, bu, metric).
    """
    __tablename__ = "anomaly_alerts"

    id               = Column(BigInteger,    primary_key=True, autoincrement=True)
    tenant_id        = Column(String(36),    nullable=False, index=True)
    business_unit_id = Column(String(36),    nullable=True,  index=True)
    module_id        = Column(String(50),    nullable=True,  index=True)
    metric           = Column(String(50),    nullable=False, index=True)
    severity         = Column(SAEnum(AlertSeverity, values_callable=lambda o: [e.value for e in o]),
                              default=AlertSeverity.WARN, nullable=False)
    threshold        = Column(Numeric(14, 4), nullable=True)
    actual           = Column(Numeric(14, 4), nullable=True)
    description      = Column(Text,           nullable=True)
    resolved_at      = Column(DateTime,       nullable=True)


class JobRun(Base, TimestampMixin):
    """
    One row per background scheduler job execution.
    tenant_id nullable: some jobs (pricing-sync) are cluster-wide (no tenant).
    Use to detect drift: status=running + no completed_at = app crashed mid-job.
    """
    __tablename__ = "job_runs"

    id            = Column(BigInteger,  primary_key=True, autoincrement=True)
    job_name      = Column(String(50),  nullable=False, index=True)
    tenant_id     = Column(String(36),  nullable=True,  index=True)
    status        = Column(SAEnum(JobStatus, values_callable=lambda o: [e.value for e in o]),
                           default=JobStatus.RUNNING, nullable=False)
    started_at    = Column(DateTime,    nullable=False, index=True)
    completed_at  = Column(DateTime,    nullable=True)
    rows_affected = Column(Integer,     nullable=True)
    error_message = Column(Text,        nullable=True)


# ── Auto-populate created_by / updated_by from request context ────────────────

def _current_actor() -> str | None:
    """Return carmen_user_id from the current request context, or None."""
    try:
        from app.context import current_carmen_user_id
        val = current_carmen_user_id.get()
        return val or None
    except Exception:
        return None


@event.listens_for(Base, "before_insert", propagate=True)
def _set_created_by(mapper, connection, target):
    if not isinstance(target, WriterMixin):
        return
    actor = _current_actor()
    if actor:
        if not target.created_by:
            target.created_by = actor
        target.updated_by = actor


@event.listens_for(Base, "before_update", propagate=True)
def _set_updated_by(mapper, connection, target):
    if isinstance(target, WriterMixin):
        actor = _current_actor()
        if actor:
            target.updated_by = actor
