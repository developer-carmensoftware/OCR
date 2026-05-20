"""Control plane — System Config, Feature Flags, Quotas, LLM Pricing."""

import uuid

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.sql import func

from app.database import Base

from .enums import QuotaMetric, QuotaPeriod
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

    tenant_id = Column(String(36), ForeignKey("tenants.id"), primary_key=True)
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

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
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
        UniqueConstraint("tenant_id", "period", "metric", name="uq_quota_tenant_period_metric"),
    )


class QuotaUsage(Base, TimestampMixin):
    """
    Running counter incremented in real-time.
    period_key format: '2026-05' (monthly) | '2026-05-14' (daily)
    """

    __tablename__ = "quota_usage"

    quota_id = Column(String(36), ForeignKey("quotas.id"), primary_key=True)
    period_key = Column(String(10), primary_key=True)
    used = Column(Numeric(18, 4), default=0, nullable=False)
    last_updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class LLMModelPricing(Base, TimestampMixin):
    """LLM model pricing synced from OpenRouter API every 8h."""

    __tablename__ = "model_pricing"

    model_name = Column(String(255), primary_key=True)
    input_price_per_1m = Column(Numeric(18, 9), default=0)
    output_price_per_1m = Column(Numeric(18, 9), default=0)
    source = Column(String(50), default="manual")
    price_verified_at = Column(DateTime, nullable=True)
