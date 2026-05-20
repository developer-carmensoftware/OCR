"""
Observability — Partitioned log tables, Analytics, Alerts, Job tracking.

FK constraints are NOT used on log tables because MariaDB does not support
foreign key constraints on partitioned tables. tenant_id / business_unit_id
are stored as plain VARCHAR(36) with indexes. Integrity is enforced by the
application layer (auth middleware sets context; services read from context).
"""

from sqlalchemy import (
    JSON,
    BigInteger,
    Column,
    DateTime,
    Float,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import Enum as SAEnum

from app.database import Base

from .enums import AlertSeverity, JobStatus
from .mixins import TimestampMixin


class LLMUsageLog(Base, TimestampMixin):
    """
    One row per LLM API call. Append-only, no soft delete.
    module_id: replaces the old free-text usage_type string — FK to modules at app level.
    cost_usd: estimated from model_pricing table at insert time.
    Partitioned: quarterly by created_at.
    """

    __tablename__ = "llm_usage_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id = Column(String(36), nullable=False, index=True)
    business_unit_id = Column(String(36), nullable=True, index=True)
    task_id = Column(String(36), nullable=True, index=True)
    module_id = Column(String(50), nullable=True, index=True)
    carmen_session_id = Column(String(36), nullable=True, index=True)
    carmen_user_id = Column(String(36), nullable=True, index=True)
    model = Column(String(100), nullable=False)
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    duration_ms = Column(Float, nullable=True)
    cost_usd = Column(Numeric(10, 6), nullable=True)


class AuditLog(Base, TimestampMixin):
    """
    Immutable event log. Append-only, no soft delete.
    Either admin_user_id OR carmen_user_id is set (never both, never neither).
    Control-plane changes include before_value / after_value JSON for diffs.
    Partitioned: quarterly by created_at.
    """

    __tablename__ = "audit_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id = Column(String(36), nullable=True, index=True)
    business_unit_id = Column(String(36), nullable=True, index=True)
    # Who performed the action
    admin_user_id = Column(String(36), nullable=True, index=True)
    carmen_user_id = Column(String(36), nullable=True, index=True)
    username = Column(String(100), nullable=True)
    session_id = Column(String(36), nullable=True, index=True)
    ip_address = Column(String(45), nullable=True)
    # What was done
    action = Column(String(50), nullable=False, index=True)
    resource = Column(String(50), nullable=True, index=True)
    resource_id = Column(String(255), nullable=True, index=True)
    # Control-plane diff (set only for admin config changes)
    target_type = Column(String(50), nullable=True, index=True)
    target_id = Column(String(100), nullable=True)
    before_value = Column(JSON, nullable=True)
    after_value = Column(JSON, nullable=True)


class PerformanceLog(Base, TimestampMixin):
    """
    HTTP request latency — one row per request via PerformanceMiddleware.
    Partitioned: quarterly by created_at.
    """

    __tablename__ = "performance_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id = Column(String(36), nullable=True, index=True)
    business_unit_id = Column(String(36), nullable=True, index=True)
    endpoint = Column(String(200), nullable=False, index=True)
    method = Column(String(10), nullable=True)
    duration_ms = Column(Float, nullable=False)
    status_code = Column(Integer, nullable=True)
    carmen_user_id = Column(String(36), nullable=True, index=True)
    resource_id = Column(String(255), nullable=True)


class OutboundCallLog(Base, TimestampMixin):
    """
    Every HTTP call made to external services (Carmen ERP, OpenRouter, etc.).
    Partitioned: quarterly by created_at.
    """

    __tablename__ = "outbound_call_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id = Column(String(36), nullable=True, index=True)
    business_unit_id = Column(String(36), nullable=True, index=True)
    service = Column(String(50), nullable=False, index=True)
    url = Column(String(500), nullable=False)
    method = Column(String(10), nullable=True)
    status_code = Column(Integer, nullable=True)
    duration_ms = Column(Float, nullable=True)
    request_size_bytes = Column(Integer, nullable=True)
    session_id = Column(String(36), nullable=True, index=True)
    carmen_user_id = Column(String(36), nullable=True)


class DailyUsageSummary(Base, TimestampMixin):
    """
    Pre-aggregated daily metrics. Built by summary_service.py nightly.
    Unique per (tenant, bu, module, date) — allows per-module cost breakdown.
    """

    __tablename__ = "daily_usage_summary"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(String(36), nullable=False, index=True)
    business_unit_id = Column(String(36), nullable=True, index=True)
    module_id = Column(String(50), nullable=True, index=True)
    summary_date = Column(DateTime, nullable=False, index=True)
    total_documents = Column(Integer, default=0)
    total_submissions = Column(Integer, default=0)
    total_llm_calls = Column(Integer, default=0)
    total_tokens = Column(BigInteger, default=0)
    total_cost_usd = Column(Numeric(12, 4), default=0)
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
            "business_unit_id",
            "module_id",
            "summary_date",
            name="uq_summary_scope_module_date",
        ),
    )


class AnomalyAlert(Base, TimestampMixin):
    """
    Anomaly detected by anomaly_service.py nightly.
    resolved_at = NULL means still open. Duplicate check: one open alert per (tenant, bu, metric).
    """

    __tablename__ = "anomaly_alerts"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id = Column(String(36), nullable=False, index=True)
    business_unit_id = Column(String(36), nullable=True, index=True)
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
    resolved_at = Column(DateTime, nullable=True)


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
    started_at = Column(DateTime, nullable=False, index=True)
    completed_at = Column(DateTime, nullable=True)
    rows_affected = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
