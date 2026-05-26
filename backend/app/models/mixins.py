"""
ORM mixins and SQLAlchemy event listeners shared by all model modules.
"""

from sqlalchemy import Column, DateTime, ForeignKey, String, event
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.sql import func

from app.database import Base


class TimestampMixin:
    """created_at (indexed) + updated_at. Applied to every table."""

    created_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class SoftDeleteMixin:
    """Logical deletion. Business tables never physically remove rows."""

    deleted_at = Column(DateTime, nullable=True, index=True)
    deleted_by = Column(String(100), nullable=True)


class WriterMixin:
    """Who created / last-modified a row. See orm.py module docstring for value format."""

    created_by = Column(String(100), nullable=True, index=True)
    updated_by = Column(String(100), nullable=True)


class TenantFKMixin:
    """
    FK-based tenancy for business data tables.
    Each tenant row is a unique (host, bu_code) pair; BU separation is achieved
    by the tenant row itself, so a single tenant_id FK suffices.
    """

    tenant_id = Column(PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)


# ── Auto-populate created_by / updated_by from request context ────────────────


def _current_actor() -> str | None:
    """Return carmen_user_id from the current request context, or None."""
    try:
        from app.context import current_carmen_user_id

        val = current_carmen_user_id.get()
        return val or None
    except Exception:
        return None


@event.listens_for(Base, "before_insert", propagate=True)
def _set_created_by(mapper, connection, target):
    if not isinstance(target, WriterMixin):
        return
    actor = _current_actor()
    if actor:
        if not target.created_by:
            target.created_by = actor  # type: ignore[assignment]
        target.updated_by = actor  # type: ignore[assignment]


@event.listens_for(Base, "before_update", propagate=True)
def _set_updated_by(mapper, connection, target):
    if isinstance(target, WriterMixin):
        actor = _current_actor()
        if actor:
            target.updated_by = actor  # type: ignore[assignment]
