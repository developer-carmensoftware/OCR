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
    """One row per (tenant, event_id) — a Carmen retry lands on the same row."""

    __tablename__ = "pms_events"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(String(100), nullable=False)
    type = Column(String(50), nullable=False)
    payload = Column(_JSON, nullable=False)

    __table_args__ = (Index("uq_pms_events_event", "tenant_id", "event_id", unique=True),)
