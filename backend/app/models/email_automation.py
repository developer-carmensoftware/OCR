"""Email Automation — per-BU ingest settings and the seen-message ledger.

See supabase/migrations/20260803000000_email_automation.sql for why the ledger
is a table of its own rather than a column on ocr_tasks.
"""

import uuid

from sqlalchemy import JSON, Boolean, Column, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from app.database import Base

from .mixins import TenantFKMixin, TimestampMixin, WriterMixin

# JSONB on Postgres, plain JSON on SQLite (the unit-test engine).
_JSON = JSON().with_variant(JSONB(), "postgresql")


class EmailIngestSettings(Base, TimestampMixin, WriterMixin):
    """What a BU configured. Written by Carmen through PUT /api/v1/carmen/settings."""

    __tablename__ = "email_ingest_settings"

    tenant_id = Column(PGUUID(as_uuid=True), ForeignKey("tenants.id"), primary_key=True)
    ingest_tag = Column(String(32), nullable=False, unique=True)
    enabled = Column(Boolean, nullable=False, default=False)
    tax_ids = Column(_JSON, nullable=False, default=list)
    rules = Column(_JSON, nullable=False, default=list)
    carmen_token_enc = Column(Text, nullable=True)


class EmailDocument(Base, TenantFKMixin, TimestampMixin):
    """One row per (message, attachment) we have looked at — the dedupe ledger."""

    __tablename__ = "email_documents"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(String(500), nullable=False)
    attachment = Column(String(255), nullable=False, default="")
    status = Column(String(20), nullable=False, default="received")
    task_id = Column(PGUUID(as_uuid=True), ForeignKey("ocr_tasks.id"), nullable=True)
    bank_code = Column(String(20), nullable=True)
    doc_no = Column(String(100), nullable=True)
    jv_no = Column(String(50), nullable=True)
    reason_code = Column(String(50), nullable=True)
    error_message = Column(Text, nullable=True)
    attempts = Column(Integer, nullable=False, default=0)

    __table_args__ = (
        Index("uq_email_documents_message", "tenant_id", "message_id", "attachment", unique=True),
    )
