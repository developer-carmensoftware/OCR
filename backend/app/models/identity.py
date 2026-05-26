"""Control plane — Identity & Multi-tenancy: Plan, Tenant.

A tenant is a (host, bu_code) pair — one row per Carmen ERP customer+BU.
Sharing a host across BUs means two distinct tenant rows; quota/config are
scoped per tenant, so each BU gets its own.
"""

import uuid

from sqlalchemy import Boolean, Column, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

from app.database import Base

from .mixins import SoftDeleteMixin, TimestampMixin, WriterMixin


class Plan(Base, TimestampMixin, WriterMixin):
    """
    Subscription plan definitions — source of truth for quota limits per tier.
    Admin Dashboard can edit monthly_call_limit without redeploy.
    """

    __tablename__ = "plans"

    code = Column(String(20), primary_key=True)
    display_name = Column(String(100), nullable=False)
    monthly_call_limit = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    tenants = relationship("Tenant", back_populates="plan_ref")


class Tenant(Base, TimestampMixin, SoftDeleteMixin, WriterMixin):
    """
    One row per (Carmen ERP host, business unit) pair.
    `host` = Carmen hostname (from JWT / X-Carmen-URI), `bu_code` = Carmen JWT `bu` claim.
    Lookup key is the composite (host, bu_code).
    """

    __tablename__ = "tenants"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    host = Column(String(255), nullable=False, index=True)
    bu_code = Column(String(100), nullable=False)
    name = Column(String(255), nullable=False)
    plan = Column(String(20), ForeignKey("plans.code"), nullable=False, default="free")
    is_active = Column(Boolean, default=True, nullable=False)
    contact_email = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)

    plan_ref = relationship("Plan", back_populates="tenants")

    __table_args__ = (
        Index(
            "uq_tenants_host_bu_active",
            "host",
            "bu_code",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )
