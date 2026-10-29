"""PMS interface (CA-93, CA-119): Carmen's hooks, the day each one names, and how it posts.

See supabase/migrations/20261007000000_pms_events.sql, 20261009000000_pms_processing.sql
and 20261015000000_pms_carmen_engine.sql. Since decision-log #43 a day posts through Carmen's
own PMS engine, so what each PMS code posts to lives in Carmen's mapping table, not here.
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
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from app.database import Base

from .encrypted_json import EncryptedJSON
from .mixins import TenantFKMixin, TimestampMixin, WriterMixin

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
    # Encrypted at rest — the day's revenue rows and amounts.
    review_payload = Column(EncryptedJSON(), nullable=True)
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


class PmsSettings(Base, TimestampMixin, WriterMixin):
    """Whether a clean day of this BU and PMS posts by itself (default: it waits).

    Set by Carmen's PMS setting screen through `/api/v1/carmen/pms/settings` (decision-log
    #44). Everything else about how a day posts — prefix, sides, the counter account — is
    the BU's PMS setting in Carmen (decision-log #43).
    """

    __tablename__ = "pms_settings"

    tenant_id = Column(PGUUID(as_uuid=True), ForeignKey("tenants.id"), primary_key=True)
    # The hook's InterfaceName, lower-case.
    interface_name = Column(String(40), primary_key=True)
    auto_post = Column(Boolean, nullable=False, default=False, server_default="false")
