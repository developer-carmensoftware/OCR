"""Control plane — System Config, Feature Flags, Quotas, LLM Pricing."""

import uuid

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    text,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.sql import func

from app.database import Base

from .enums import (
    BillingDocumentType,
    CreditLedgerReason,
    CreditOrderStatus,
    QuotaMetric,
    QuotaPeriod,
    SubscriptionStatus,
)
from .mixins import SoftDeleteMixin, TimestampMixin, WriterMixin


class SystemConfig(Base, TimestampMixin, WriterMixin):
    """
    Global key-value configuration (DB-driven settings).
    Secrets (JWT key, encryption key, DB URL) MUST stay in .env — never enter DB.
    """

    __tablename__ = "system_configs"

    key_name = Column(String(100), primary_key=True)
    value = Column(JSON, nullable=False)
    value_type = Column(String(20), nullable=False)
    category = Column(String(50), nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_secret = Column(Boolean, default=False, nullable=False)
    requires_restart = Column(Boolean, default=False, nullable=False)
    default_value = Column(JSON, nullable=True)
    validation_regex = Column(String(500), nullable=True)


class TenantConfigOverride(Base, TimestampMixin, WriterMixin):
    """Per-tenant override of a system_configs entry. Lookup: tenant_override → global → default."""

    __tablename__ = "tenant_config_overrides"

    tenant_id = Column(PGUUID(as_uuid=True), ForeignKey("tenants.id"), primary_key=True)
    key_name = Column(String(100), ForeignKey("system_configs.key_name"), primary_key=True)
    value = Column(JSON, nullable=False)


class FeatureFlag(Base, TimestampMixin, WriterMixin):
    """
    Boolean feature toggles with per-tenant override and gradual rollout.
    enabled_tenants: JSON array of tenant_ids that override enabled_global.
    rollout_pct: 0-100 — used when enabled_global=True to gradually roll out.
    """

    __tablename__ = "feature_flags"

    flag_key = Column(String(100), primary_key=True)
    description = Column(Text, nullable=True)
    enabled_global = Column(Boolean, default=False, nullable=False)
    enabled_tenants = Column(JSON, nullable=True)
    rollout_pct = Column(Integer, default=0, nullable=False)


class Quota(Base, TimestampMixin, SoftDeleteMixin, WriterMixin):
    """
    Quota rule per tenant — shared pool across ALL modules.
    is_hard = True → block at limit; False → warn only.
    """

    __tablename__ = "quotas"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    period: Column = Column(
        SAEnum(QuotaPeriod, values_callable=lambda o: [e.value for e in o]), nullable=False
    )
    metric: Column = Column(
        SAEnum(QuotaMetric, values_callable=lambda o: [e.value for e in o]), nullable=False
    )
    limit_value = Column(Numeric(18, 4), nullable=False)
    soft_warn_pct = Column(Numeric(3, 2), default=0.80, nullable=False)
    is_hard = Column(Boolean, default=True, nullable=False)
    is_custom = Column(Boolean, default=False, nullable=False)

    __table_args__ = (
        Index(
            "uq_quota_tenant_period_metric_active",
            "tenant_id",
            "period",
            "metric",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )


class QuotaUsage(Base, TimestampMixin):
    """
    Running counter incremented in real-time.
    period_key format: '2026-05' (monthly) | '2026-05-14' (daily)
    """

    __tablename__ = "quota_usage"

    quota_id = Column(PGUUID(as_uuid=True), ForeignKey("quotas.id"), primary_key=True)
    period_key = Column(String(10), primary_key=True)
    used = Column(Numeric(18, 4), default=0, nullable=False)
    last_updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class LLMModelPricing(Base, TimestampMixin):
    """LLM model pricing synced from OpenRouter API every 8h."""

    __tablename__ = "model_pricing"

    model_name = Column(String(255), primary_key=True)
    input_price_per_1m = Column(Numeric(18, 9), default=0)
    output_price_per_1m = Column(Numeric(18, 9), default=0)
    source = Column(String(50), default="manual")
    price_verified_at = Column(DateTime(timezone=True), nullable=True)


# ── Top-up credits ────────────────────────────────────────────────────────────
# Every tenant gets a free monthly document quota (the `quotas` MONTHLY/CALLS
# rule). When that is exhausted, extraction consumes from a persistent top-up
# credit balance that never expires (rolls over month to month). These tables
# implement that balance, its audit ledger, the purchasable pack catalog, and a
# stub order table so a payment gateway can plug in later.


class CreditPack(Base, TimestampMixin, WriterMixin):
    """
    Purchasable top-up pack catalog (CMS-editable like banks/plans).
    The free 30 docs/month tier is NOT a pack — it lives in the quotas table.
    """

    __tablename__ = "credit_packs"

    code = Column(String(20), primary_key=True)  # 'sub_standard', 'pack_small', ...
    # 'subscription' = monthly document tier; 'topup' = one-time non-expiring credits.
    kind = Column(String(20), nullable=False, default="topup")
    credits = Column(Integer, nullable=False)
    price_thb = Column(Numeric(10, 2), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)


class TenantCredit(Base, TimestampMixin):
    """Persistent top-up balance per tenant — runtime source of truth."""

    __tablename__ = "tenant_credits"

    tenant_id = Column(PGUUID(as_uuid=True), ForeignKey("tenants.id"), primary_key=True)
    balance = Column(Integer, nullable=False, default=0)
    credits_purchased = Column(Integer, nullable=False, default=0)
    credits_consumed = Column(Integer, nullable=False, default=0)


class CreditLedger(Base, TimestampMixin, WriterMixin):
    """Append-only audit of every credit balance change."""

    __tablename__ = "credit_ledger"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    delta = Column(Integer, nullable=False)  # +grant / -consumption
    balance_after = Column(Integer, nullable=False)
    reason: Column = Column(
        SAEnum(CreditLedgerReason, values_callable=lambda o: [e.value for e in o]),
        nullable=False,
    )
    pack_code = Column(String(20), ForeignKey("credit_packs.code"), nullable=True)
    ref = Column(Text, nullable=True)  # ocr_task id / order id / filename
    note = Column(Text, nullable=True)

    __table_args__ = (Index("ix_credit_ledger_tenant_created", "tenant_id", "created_at"),)


class CreditOrder(Base, TimestampMixin, SoftDeleteMixin, WriterMixin):
    """
    Top-up order — groundwork for a future payment gateway.
    v1: created as 'pending'; an admin (or webhook later) marks it 'paid',
    which grants the credits and writes a ledger row.
    """

    __tablename__ = "credit_orders"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    pack_code = Column(String(20), ForeignKey("credit_packs.code"), nullable=False)
    credits = Column(Integer, nullable=False)
    amount_thb = Column(Numeric(10, 2), nullable=False)
    # 'monthly' | 'annual' — chosen at checkout; drives price + the license window.
    billing_period = Column(String(10), nullable=False, default="monthly")
    status: Column = Column(
        SAEnum(CreditOrderStatus, values_callable=lambda o: [e.value for e in o]),
        nullable=False,
        default=CreditOrderStatus.IN_PROGRESS,
    )
    payment_ref = Column(String(128), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    approved_by = Column(String(100), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    # Proforma valid-until — server-enforced 14-day window (auto-cancel if unpaid).
    expires_at = Column(DateTime(timezone=True), nullable=True)
    # Slip upload (added migration 218)
    slip_object_key = Column(String(512), nullable=True)
    slip_uploaded_at = Column(DateTime(timezone=True), nullable=True)
    rejected_reason = Column(Text, nullable=True)
    admin_note = Column(Text, nullable=True)
    proration_credit_thb = Column(Numeric(10, 2), nullable=False, default=0, server_default="0")
    # Carmen AR posting (set when order is posted to Carmen ERP)
    carmen_ar_posted_at = Column(DateTime(timezone=True), nullable=True)
    carmen_ar_ref = Column(String(255), nullable=True)

    __table_args__ = (
        Index(
            "ix_credit_orders_tenant_status",
            "tenant_id",
            "status",
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "uq_credit_orders_one_open_per_tenant",
            "tenant_id",
            unique=True,
            postgresql_where=text("status = 'in_progress' AND deleted_at IS NULL"),
        ),
    )


class BillingDocument(Base, TimestampMixin, SoftDeleteMixin):
    """
    Immutable snapshot of a proforma or tax invoice for a credit order.
    Issued at order creation (proforma) and admin approval (tax_invoice).
    Frontend renders and prints this as HTML — no server-side PDF.
    """

    __tablename__ = "billing_documents"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    order_id = Column(PGUUID(as_uuid=True), ForeignKey("credit_orders.id"), nullable=False)
    doc_type: Column = Column(
        SAEnum(BillingDocumentType, values_callable=lambda o: [e.value for e in o]),
        nullable=False,
    )
    number = Column(String(50), nullable=False)  # e.g. PF-202606-0001 / IV-202606-0001
    issue_date = Column(DateTime(timezone=True), nullable=False)

    # Seller snapshot (from system_configs at issue time)
    seller_name = Column(String(255), nullable=True)
    seller_tax_id = Column(String(20), nullable=True)
    seller_address = Column(Text, nullable=True)
    seller_branch = Column(String(100), nullable=True)

    # Buyer snapshot (from Carmen-or-form at issue time)
    buyer_name = Column(String(255), nullable=True)
    buyer_tax_id = Column(String(20), nullable=True)
    buyer_address = Column(Text, nullable=True)
    buyer_branch = Column(String(100), nullable=True)
    buyer_email = Column(String(255), nullable=True)
    buyer_contact_name = Column(String(255), nullable=True)

    # Single line item = the pack purchased
    pack_code = Column(String(20), nullable=False)
    description = Column(Text, nullable=True)
    credits = Column(Integer, nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False)  # ex-VAT
    vat_rate = Column(Numeric(4, 2), nullable=False, default=7.00)
    vat_amount = Column(Numeric(12, 2), nullable=False)
    total = Column(Numeric(12, 2), nullable=False)  # gross (VAT-inclusive)
    currency = Column(String(3), nullable=False, default="THB")

    __table_args__ = (
        Index(
            "uq_billing_documents_number_active",
            "number",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index("ix_billing_documents_tenant_type", "tenant_id", "doc_type", "created_at"),
    )


class TenantSubscription(Base, TimestampMixin):
    """
    A tenant's monthly document subscription window (use-it-or-lose-it).

    Created when an admin approves a `kind='subscription'` order. One active row
    per tenant (Option A: renew only after the current cycle lapses). Consumption
    and "current plan" lookups are window-based (period_start <= now < period_end),
    so a future-dated/queued row (Option B) would Just Work without code changes.
    """

    __tablename__ = "tenant_subscriptions"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    plan_code = Column(String(20), ForeignKey("credit_packs.code"), nullable=False)
    doc_allowance = Column(Integer, nullable=False)  # per-month allowance, both periods
    docs_used = Column(Integer, nullable=False, default=0)  # used in the current month-cycle
    period_start = Column(DateTime(timezone=True), nullable=False)
    period_end = Column(DateTime(timezone=True), nullable=False)
    # 'monthly' (window == one cycle) | 'annual' (year-long window, docs_used resets
    # each month). cycle_start tracks the month-cycle docs_used currently belongs to.
    billing_period = Column(String(10), nullable=False, default="monthly")
    cycle_start = Column(DateTime(timezone=True), nullable=True)
    status: Column = Column(
        SAEnum(SubscriptionStatus, values_callable=lambda o: [e.value for e in o]),
        nullable=False,
        default=SubscriptionStatus.ACTIVE,
    )
    source_order_id = Column(PGUUID(as_uuid=True), ForeignKey("credit_orders.id"), nullable=True)

    __table_args__ = (
        Index("ix_tenant_subscriptions_window", "tenant_id", "status", "period_end"),
        Index(
            "uq_tenant_subscriptions_one_active",
            "tenant_id",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
    )


class ArCustomerProfile(Base, TimestampMixin, SoftDeleteMixin):
    """Unique buyer companies for Carmen AR code mapping."""

    __tablename__ = "ar_customer_profiles"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    buyer_name = Column(String(255), nullable=False)
    buyer_tax_id = Column(String(20), nullable=False, default="")
    buyer_branch = Column(String(100), nullable=False, default="")
    carmen_ar_code = Column(String(50), nullable=True)

    __table_args__ = (
        Index(
            "uq_ar_profiles_taxid_branch",
            "buyer_tax_id",
            "buyer_branch",
            unique=True,
            postgresql_where=text("deleted_at IS NULL AND buyer_tax_id != ''"),
        ),
        Index(
            "ix_ar_profiles_name",
            "buyer_name",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )


class DocumentSequence(Base):
    """
    Gapless document number counter per (scope, period_key).
    Atomic upsert: INSERT ... ON CONFLICT DO UPDATE SET last_no = last_no + 1 RETURNING last_no.
    scope = 'proforma' | 'tax_invoice', period_key = 'YYYYMM'.
    Formatted: PF-{YYYYMM}-{last_no:04d} / IV-{YYYYMM}-{last_no:04d}.
    """

    __tablename__ = "document_sequences"

    scope = Column(String(20), primary_key=True)
    period_key = Column(String(6), primary_key=True)
    last_no = Column(Integer, nullable=False, default=0)
