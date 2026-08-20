"""Email Automation — per-BU ingest settings and the seen-message ledger.

See supabase/migrations/20260803000000_email_automation.sql for why the ledger
is a table of its own rather than a column on ocr_tasks.
"""

import uuid

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
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
    # AIAGENT+<tag>@… — identifies the BU from the envelope, before any LLM call.
    # Nullable: allocated on the first successful enable, so a BU that never buys
    # anything never consumes one. Never reissued once allocated.
    ingest_tag = Column(String(32), nullable=True)
    enabled = Column(Boolean, nullable=False, default=False)
    # The customer's own addresses. Empty = accept any sender; non-empty = the message
    # must carry one of them in From/To/Cc. A second layer, not the routing key — these
    # headers are composed by the sender, unlike the envelope tag. See the migration.
    owner_emails = Column(_JSON, nullable=False, default=list)
    tax_ids = Column(_JSON, nullable=False, default=list)
    rules = Column(_JSON, nullable=False, default=list)
    # Must be replayed to Carmen on every post, so it is encrypted, not hashed.
    carmen_token_enc = Column(Text, nullable=True)
    carmen_uri = Column(Text, nullable=True)
    carmen_token_fp = Column(String(16), nullable=True)
    carmen_token_verified_at = Column(DateTime(timezone=True), nullable=True)
    # Gmail's forwarding confirmation code, addressed to this BU's tag. Single-use and
    # overwritten by the next one — the settings screen shows it so the customer can
    # finish the handshake without anyone opening the shared mailbox.
    #
    # Kept, but expect it to be null: measured against four real confirmation mails on
    # 2026-08-07 (Thai personal Gmail and English Workspace), Google no longer prints a
    # code in the subject or the body at all — only the confirmation link. The subject
    # still carries the vestigial "(" where "#code)" used to sit.
    gmail_confirm_code = Column(String(32), nullable=True)
    gmail_confirm_at = Column(DateTime(timezone=True), nullable=True)
    # When the poll followed the confirmation link itself and Google accepted it. This is
    # the handshake actually completing, which the code above no longer can — so it is
    # what the settings screen reads to say "done" rather than "waiting for a code".
    gmail_confirmed_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index(
            "uq_email_ingest_tag",
            "ingest_tag",
            unique=True,
            postgresql_where=text("ingest_tag is not null"),
        ),
    )


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
