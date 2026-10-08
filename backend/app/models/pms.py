"""PMS interface (CA-93) — what Carmen pushed to POST /api/v1/pms/events.

See supabase/migrations/20261007000000_pms_events.sql.
"""

import uuid

from sqlalchemy import JSON, Column, Index, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from app.database import Base

from .mixins import TenantFKMixin, TimestampMixin

# JSONB on Postgres, plain JSON on SQLite (the unit-test engine).
_JSON = JSON().with_variant(JSONB(), "postgresql")


class PmsEvent(Base, TenantFKMixin, TimestampMixin):
    """One row per BU and Data Bank day: Carmen's hook said that day is ready.

    `event_id` is `PmsEventIn.key` (`PMS/Comanche/Daily/2026-10-07`), `type` the
    InterfaceType, `payload` the hook as sent. A repeat of the same day lands on the same row
    and moves `updated_at`. The column names predate Carmen's real hook (CA-93 phase 1).
    """

    __tablename__ = "pms_events"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(String(100), nullable=False)
    type = Column(String(50), nullable=False)
    payload = Column(_JSON, nullable=False)

    __table_args__ = (Index("uq_pms_events_event", "tenant_id", "event_id", unique=True),)
