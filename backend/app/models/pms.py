"""PMS interface (CA-93, CA-119): Carmen's hooks, the day each one names, and how it posts.

See supabase/migrations/20261007000000_pms_events.sql and 20261009000000_pms_processing.sql.
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

from .mixins import SoftDeleteMixin, TenantFKMixin, TimestampMixin, WriterMixin

# JSONB on Postgres, plain JSON on SQLite (the unit-test engine).
_JSON = JSON().with_variant(JSONB(), "postgresql")


class PmsEvent(Base, TenantFKMixin, TimestampMixin):
    """One row per BU and Data Bank day: Carmen's hook said that day is ready.

    `event_id` is `PmsEventIn.key` (`PMS/Comanche/Daily/2026-10-07`), `type` the
    InterfaceType, `payload` the hook as sent. A repeat of the same day lands on the same row
    and moves `updated_at`. The column names predate Carmen's real hook (CA-93 phase 1).

    The rest is the day's processing state (CA-119), the same ledger shape as
    `EmailDocument`: `services/pms/process.py` reads the day back and parks or posts it,
    `services/pms/review.py` is the person's half.
    """

    __tablename__ = "pms_events"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(String(100), nullable=False)
    type = Column(String(50), nullable=False)
    payload = Column(_JSON, nullable=False)
    # received → pending_review → posted | rejected; failed once the retries ran out.
    status = Column(String(20), nullable=False, default="received", server_default="received")
    # Set only while a person owes the day a decision; cleared on every terminal transition.
    review_payload = Column(_JSON, nullable=True)
    jv_no = Column(String(50), nullable=True)
    reason_code = Column(String(50), nullable=True)
    error_message = Column(Text, nullable=True)
    attempts = Column(Integer, nullable=False, default=0, server_default="0")
    processed_at = Column(DateTime(timezone=True), nullable=True)
    # The approve/reject claim; expires (`review.CLAIM_TTL`), so it cannot strand a day.
    posting_started_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by = Column(String(36), nullable=True)
    reviewed_by_name = Column(String(100), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("uq_pms_events_event", "tenant_id", "event_id", unique=True),
        Index("ix_pms_events_tenant_status", "tenant_id", "status"),
    )


class PmsCodeMapping(Base, TenantFKMixin, TimestampMixin, SoftDeleteMixin, WriterMixin):
    """What one PMS code posts to, for this BU and interface.

    Keyed on the code, never its description (descriptions drift). `code_key` is
    `<TransactionType>|<Code>`, `Ledger|<Code>` for the two ledgers, or one of the rules
    `VAT|*` / `SVC|*`. Written by the review's Approve, which is what turns the AI's pick
    into the BU's rule — the same contract as the email review's GL rules.
    """

    __tablename__ = "pms_code_mappings"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    interface_name = Column(String(40), nullable=False)
    code_key = Column(String(120), nullable=False)
    dept_code = Column(String(20), nullable=False)
    acc_code = Column(String(20), nullable=False)
    source = Column(String(10), nullable=False, default="user", server_default="user")

    __table_args__ = (
        Index(
            "uq_pms_code_mappings_key",
            "tenant_id",
            "interface_name",
            "code_key",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )


class PmsSettings(Base, TimestampMixin, WriterMixin):
    """How this BU's PMS days post, set on #/pms. No prefix means nothing posts."""

    __tablename__ = "pms_settings"

    tenant_id = Column(PGUUID(as_uuid=True), ForeignKey("tenants.id"), primary_key=True)
    jv_prefix = Column(String(20), nullable=True)
    auto_post = Column(Boolean, nullable=False, default=False, server_default="false")
