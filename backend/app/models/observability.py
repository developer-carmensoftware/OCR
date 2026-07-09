"""
Observability — Log tables, Analytics, Alerts, Job tracking.

Log tables (llm_usage_logs, audit_logs, performance_logs, outbound_call_logs) are
PARTITIONED BY RANGE (created_at) — see migration 20260615000001_partition_log_tables.sql.
Partition key (created_at) is part of the composite PK: (id, created_at).

FK constraints are NOT used on log tables: VARCHAR(36) tenant_id with no FK is
intentional — write throughput > referential integrity on append-only high-volume logs.
"""

from sqlalchemy import (
    JSON,
    BigInteger,
    Column,
    Date,
    DateTime,
    Float,
    Identity,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy import Enum as SAEnum

from app.database import Base

from .enums import AlertSeverity, JobStatus
from .mixins import TimestampMixin


class LLMUsageLog(Base):
    """One row per LLM API call. Append-only. Partitioned by created_at (monthly)."""

    __tablename__ = "llm_usage_logs"

    # Composite PK required by the partitioned table (partition key must be in PK).
    id = Column(BigInteger, Identity(always=True), primary_key=True)
    created_at = Column(
        DateTime(timezone=True), primary_key=True, nullable=False, default=func.now()
    )
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    tenant_id = Column(String(36), nullable=False)
    task_id = Column(String(36), nullable=True)
    module_id = Column(String(50), nullable=True)
    carmen_session_id = Column(String(36), nullable=True)
    carmen_user_id = Column(String(36), nullable=True)
    model = Column(String(100), nullable=False)
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    duration_ms = Column(Float, nullable=True)
    cost_usd = Column(Numeric(10, 6), nullable=True)


class AuditLog(Base):
    """
    Immutable event log. Append-only. Partitioned by created_at (monthly, 24-month retention).
    Either admin_user_id OR carmen_user_id is set (never both, never neither).
    """

    __tablename__ = "audit_logs"

    id = Column(BigInteger, Identity(always=True), primary_key=True)
    created_at = Column(
        DateTime(timezone=True), primary_key=True, nullable=False, default=func.now()
    )
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    tenant_id = Column(String(36), nullable=True)
    admin_user_id = Column(String(36), nullable=True)
    carmen_user_id = Column(String(36), nullable=True)
    username = Column(String(100), nullable=True)
    session_id = Column(String(36), nullable=True)
    ip_address = Column(String(45), nullable=True)
    action = Column(String(50), nullable=False)
    resource = Column(String(50), nullable=True)
    resource_id = Column(String(255), nullable=True)
    target_type = Column(String(50), nullable=True)
    target_id = Column(String(100), nullable=True)
    before_value = Column(JSON, nullable=True)
    after_value = Column(JSON, nullable=True)


class PerformanceLog(Base):
    """HTTP request latency — one row per request via PerformanceMiddleware. Partitioned monthly."""

    __tablename__ = "performance_logs"

    id = Column(BigInteger, Identity(always=True), primary_key=True)
    created_at = Column(
        DateTime(timezone=True), primary_key=True, nullable=False, default=func.now()
    )
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    tenant_id = Column(String(36), nullable=True)
    endpoint = Column(String(200), nullable=False)
    method = Column(String(10), nullable=True)
    duration_ms = Column(Float, nullable=False)
    status_code = Column(Integer, nullable=True)
    carmen_user_id = Column(String(36), nullable=True)
    resource_id = Column(String(255), nullable=True)


class OutboundCallLog(Base):
    """Every HTTP call to external services (Carmen ERP, OpenRouter). Partitioned monthly."""

    __tablename__ = "outbound_call_logs"

    id = Column(BigInteger, Identity(always=True), primary_key=True)
    created_at = Column(
        DateTime(timezone=True), primary_key=True, nullable=False, default=func.now()
    )
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    tenant_id = Column(String(36), nullable=True)
    service = Column(String(50), nullable=False)
    url = Column(String(500), nullable=False)
    method = Column(String(10), nullable=True)
    status_code = Column(Integer, nullable=True)
    duration_ms = Column(Float, nullable=True)
    request_size_bytes = Column(Integer, nullable=True)
    session_id = Column(String(36), nullable=True)
    carmen_user_id = Column(String(36), nullable=True)


class DailyUsageSummary(Base, TimestampMixin):
    """
    Pre-aggregated daily metrics. Built by summary_service.build_daily_summary nightly.
    Unique per (tenant, module, date). Used by anomaly_service + quota dashboards.
    Kept indefinitely — small footprint, source of long-term trend data.
    """

    __tablename__ = "daily_usage_summary"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(String(36), nullable=False, index=True)
    module_id = Column(String(50), nullable=True, index=True)
    summary_date = Column(Date, nullable=False, index=True)
    total_documents = Column(Integer, default=0)
    total_submissions = Column(Integer, default=0)
    total_llm_calls = Column(Integer, default=0)
    total_tokens = Column(BigInteger, default=0)
    total_cost_usd = Column(Numeric(14, 6), default=0)
    avg_llm_latency_ms = Column(Float, default=0)
    total_api_calls = Column(Integer, default=0)
    avg_api_latency_ms = Column(Float, default=0)
    p95_api_latency_ms = Column(Float, default=0)
    total_errors = Column(Integer, default=0)
    total_corrections = Column(Integer, default=0)
    total_outbound_calls = Column(Integer, default=0)

    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "module_id",
            "summary_date",
            name="uq_summary_scope_module_date",
        ),
    )


class DailyModelCost(Base, TimestampMixin):
    """
    Cost breakdown by LLM model per tenant/module/day.
    Built nightly from llm_usage_logs by summary_service.build_daily_model_cost.
    Kept indefinitely — small footprint (one row per active model per tenant per day).
    """

    __tablename__ = "daily_model_cost"

    id = Column(Integer, primary_key=True, autoincrement=True)
    summary_date = Column(Date, nullable=False, index=True)
    tenant_id = Column(String(36), nullable=False, index=True)
    module_id = Column(String(50), nullable=True, index=True)
    model_name = Column(String(100), nullable=False)
    call_count = Column(Integer, default=0)
    input_tokens = Column(BigInteger, default=0)
    output_tokens = Column(BigInteger, default=0)
    cost_usd = Column(Numeric(12, 6), default=0)

    __table_args__ = (
        UniqueConstraint(
            "summary_date",
            "tenant_id",
            "module_id",
            "model_name",
            name="uq_daily_model_cost",
        ),
    )


class MonthlyUsageSummary(Base, TimestampMixin):
    """
    Monthly rollup of daily_usage_summary, populated by
    summary_service.build_monthly_summary. summary_date stores the first day
    of the month (YYYY-MM-01). Kept indefinitely.
    """

    __tablename__ = "monthly_usage_summary"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(String(36), nullable=False, index=True)
    module_id = Column(String(50), nullable=True, index=True)
    summary_date = Column(Date, nullable=False, index=True)
    total_documents = Column(Integer, default=0)
    total_submissions = Column(Integer, default=0)
    total_llm_calls = Column(Integer, default=0)
    total_tokens = Column(BigInteger, default=0)
    total_cost_usd = Column(Numeric(14, 6), default=0)
    avg_llm_latency_ms = Column(Float, default=0)
    total_api_calls = Column(Integer, default=0)
    avg_api_latency_ms = Column(Float, default=0)
    p95_api_latency_ms = Column(Float, default=0)
    total_errors = Column(Integer, default=0)
    total_corrections = Column(Integer, default=0)
    total_outbound_calls = Column(Integer, default=0)

    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "module_id",
            "summary_date",
            name="uq_monthly_summary_scope",
        ),
    )


class AnomalyAlert(Base, TimestampMixin):
    """
    Anomaly detected by anomaly_service.py nightly.
    resolved_at = NULL means still open. Duplicate check: one open alert per (tenant, metric).
    """

    __tablename__ = "anomaly_alerts"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id = Column(String(36), nullable=False, index=True)
    module_id = Column(String(50), nullable=True, index=True)
    metric = Column(String(50), nullable=False, index=True)
    severity: Column = Column(
        SAEnum(AlertSeverity, values_callable=lambda o: [e.value for e in o]),
        default=AlertSeverity.WARN,
        nullable=False,
    )
    threshold = Column(Numeric(14, 4), nullable=True)
    actual = Column(Numeric(14, 4), nullable=True)
    description = Column(Text, nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)


class JobRun(Base, TimestampMixin):
    """
    One row per background scheduler job execution.
    tenant_id nullable: some jobs (pricing-sync) are cluster-wide (no tenant).
    Use to detect drift: status=running + no completed_at = app crashed mid-job.
    """

    __tablename__ = "job_runs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    job_name = Column(String(50), nullable=False, index=True)
    tenant_id = Column(String(36), nullable=True, index=True)
    status: Column = Column(
        SAEnum(JobStatus, values_callable=lambda o: [e.value for e in o]),
        default=JobStatus.RUNNING,
        nullable=False,
    )
    started_at = Column(DateTime(timezone=True), nullable=False, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    rows_affected = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
