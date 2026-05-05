import uuid

from sqlalchemy import (
    JSON, BigInteger, Boolean, Column, Float, Numeric,
    String, DateTime, Text, Integer, ForeignKey, UniqueConstraint,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base
from .enums import TaskStatus, BankType


class OCRTask(Base):
    __tablename__ = "ocr_tasks"

    id                = Column(String(36),  primary_key=True, default=lambda: str(uuid.uuid4()))
    original_filename = Column(String(255), nullable=False)
    status            = Column(SAEnum(TaskStatus, values_callable=lambda obj: [e.value for e in obj]),
                               default=TaskStatus.PENDING, nullable=False)
    ocr_engine        = Column(String(100), nullable=True)
    error_message     = Column(Text,        nullable=True)
    created_at        = Column(DateTime,    server_default=func.now())
    completed_at      = Column(DateTime,    nullable=True)

    credit_card = relationship("CreditCard", back_populates="task", uselist=False)


class CreditCard(Base):
    __tablename__ = "credit_cards"

    id               = Column(String(36),  primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id          = Column(String(36),  ForeignKey("ocr_tasks.id"), nullable=False)
    bank_name        = Column(String(255), nullable=True)
    bank_type        = Column(SAEnum(BankType, values_callable=lambda obj: [e.value for e in obj]), nullable=True)
    doc_name         = Column(String(255), nullable=True)
    company_name     = Column(String(255), nullable=True)
    doc_date         = Column(String(50),  nullable=True)
    doc_no           = Column(String(100), nullable=True, index=True)
    merchant_name    = Column(String(255), nullable=True)
    bank_companyname = Column(String(255), nullable=True)
    branch_no        = Column(String(50),  nullable=True)
    transactions     = Column(JSON,        nullable=True)
    submitted_at     = Column(DateTime,    nullable=True)
    created_at       = Column(DateTime,    server_default=func.now())

    task = relationship("OCRTask", back_populates="credit_card")


class MappingHistory(Base):
    __tablename__ = "mapping_history"

    id             = Column(Integer,     primary_key=True, autoincrement=True)
    bank_name      = Column(String(100), nullable=False, index=True)
    field_type     = Column(String(100), nullable=False)
    dept_code      = Column(String(100), nullable=True)
    acc_code       = Column(String(100), nullable=True)
    confirmed_count = Column(Integer,   default=1)
    updated_at     = Column(DateTime,   server_default=func.now())

    __table_args__ = (
        UniqueConstraint("bank_name", "field_type", "dept_code", "acc_code",
                         name="uq_mapping_bank_field_choice"),
    )


class CorrectionFeedback(Base):
    __tablename__ = "correction_feedback"

    id              = Column(Integer,     primary_key=True, autoincrement=True)
    doc_no          = Column(String(100), nullable=False, index=True)
    bank_type       = Column(String(50),  nullable=False, index=True)
    field_name      = Column(String(100), nullable=False, index=True)
    original_value  = Column(Text,        nullable=True)
    corrected_value = Column(Text,        nullable=True)
    user_id         = Column(String(100), nullable=True, index=True)
    created_at      = Column(DateTime,    server_default=func.now())

    __table_args__ = (
        UniqueConstraint("doc_no", "field_name", name="uq_correction_doc_field"),
    )


class LLMUsageLog(Base):
    __tablename__ = "llm_usage_logs"

    id                = Column(Integer,      primary_key=True, autoincrement=True)
    task_id           = Column(String(36),   ForeignKey("ocr_tasks.id"), nullable=True)
    usage_type        = Column(String(50),   nullable=True)
    model             = Column(String(100),  nullable=False)
    prompt_tokens     = Column(Integer,      default=0)
    completion_tokens = Column(Integer,      default=0)
    total_tokens      = Column(Integer,      default=0)
    duration_ms       = Column(Float,        nullable=True)
    cost_usd          = Column(Numeric(10, 6), nullable=True)
    session_id        = Column(String(36),   nullable=True, index=True)
    user_id           = Column(String(100),  nullable=True, index=True)
    bu_name           = Column(String(100),  nullable=True, index=True)
    created_at        = Column(DateTime,     server_default=func.now())

    task = relationship("OCRTask")


class OcrSession(Base):
    __tablename__ = "ocr_sessions"

    id                     = Column(String(36),  primary_key=True, default=lambda: str(uuid.uuid4()))
    carmen_token_encrypted = Column(Text,        nullable=False)
    user_id                = Column(String(100), nullable=True, index=True)
    username               = Column(String(100), nullable=True)
    bu                     = Column(String(100), nullable=True, index=True)
    is_active              = Column(Boolean,     default=True, nullable=False)
    created_at             = Column(DateTime,    server_default=func.now())
    last_used_at           = Column(DateTime,    nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id           = Column(BigInteger,   primary_key=True, autoincrement=True)
    session_id   = Column(String(36),   nullable=True, index=True)
    user_id      = Column(String(100),  nullable=True, index=True)
    username     = Column(String(100),  nullable=True)
    bu           = Column(String(100),  nullable=True, index=True)
    action       = Column(String(50),   nullable=False, index=True)
    resource     = Column(String(50),   nullable=True)
    document_ref = Column(String(255),  nullable=True)
    ip_address   = Column(String(45),   nullable=True)
    created_at   = Column(DateTime,     server_default=func.now(), index=True)


class PerformanceLog(Base):
    __tablename__ = "performance_logs"

    id           = Column(BigInteger,   primary_key=True, autoincrement=True)
    endpoint     = Column(String(200),  nullable=False, index=True)
    method       = Column(String(10),   nullable=True)
    duration_ms  = Column(Float,        nullable=False)
    status_code  = Column(Integer,      nullable=True)
    user_id      = Column(String(100),  nullable=True, index=True)
    document_ref = Column(String(255),  nullable=True)
    created_at   = Column(DateTime,     server_default=func.now(), index=True)


class OutboundCallLog(Base):
    __tablename__ = "outbound_call_logs"

    id                 = Column(BigInteger,  primary_key=True, autoincrement=True)
    service            = Column(String(50),  nullable=False, index=True)
    url                = Column(String(500), nullable=False)
    method             = Column(String(10),  nullable=True)
    status_code        = Column(Integer,     nullable=True)
    duration_ms        = Column(Float,       nullable=True)
    request_size_bytes = Column(Integer,     nullable=True)
    session_id         = Column(String(36),  nullable=True, index=True)
    user_id            = Column(String(100), nullable=True)
    created_at         = Column(DateTime,    server_default=func.now(), index=True)


class DailyUsageSummary(Base):
    __tablename__ = "daily_usage_summary"

    id                   = Column(Integer,      primary_key=True, autoincrement=True)
    summary_date         = Column(DateTime,     nullable=False, index=True)
    total_documents      = Column(Integer,      default=0)
    total_submissions    = Column(Integer,      default=0)
    total_llm_calls      = Column(Integer,      default=0)
    total_tokens         = Column(BigInteger,   default=0)
    total_cost_usd       = Column(Numeric(12, 4), default=0)
    avg_llm_latency_ms   = Column(Float,        default=0)
    total_api_calls      = Column(Integer,      default=0)
    avg_api_latency_ms   = Column(Float,        default=0)
    p95_api_latency_ms   = Column(Float,        default=0)
    total_errors         = Column(Integer,      default=0)
    total_corrections    = Column(Integer,      default=0)
    total_outbound_calls = Column(Integer,      default=0)
    created_at           = Column(DateTime,     server_default=func.now())

    __table_args__ = (
        UniqueConstraint("summary_date", name="uq_summary_date"),
    )


class LLMModelPricing(Base):
    __tablename__ = "model_pricing"

    model_name           = Column(String(255),    primary_key=True)
    input_price_per_1m   = Column(Numeric(18, 9), default=0)
    output_price_per_1m  = Column(Numeric(18, 9), default=0)
    source               = Column(String(50),     default="manual")
    price_verified_at    = Column(DateTime,       nullable=True)
    updated_at           = Column(DateTime,       server_default=func.now(), onupdate=func.now())


class APInvoice(Base):
    __tablename__ = "ap_invoices"

    id                = Column(String(36),  primary_key=True)
    task_id           = Column(String(36),  ForeignKey("ocr_tasks.id"), index=True)
    user_id           = Column(String(36),  index=True)
    vendor_name       = Column(String(255), nullable=True)
    doc_no            = Column(String(100), nullable=True)
    doc_date          = Column(String(50),  nullable=True)
    original_filename = Column(String(255), nullable=True)
    submitted_at      = Column(DateTime,    nullable=True)
    created_at        = Column(DateTime,    server_default=func.now())

class BUUsage(Base):
    __tablename__ = "bu_usage"

    bu_name           = Column(String(100), primary_key=True)
    monthly_calls     = Column(Integer,      default=0)
    total_calls       = Column(BigInteger,   default=0)
    max_monthly_calls = Column(Integer,      default=50) # Default free tier limit
    last_reset_month  = Column(String(7),    nullable=True) # e.g. "2026-05"
    updated_at        = Column(DateTime,     server_default=func.now(), onupdate=func.now())
