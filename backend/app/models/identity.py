"""Control plane — Identity & Multi-tenancy: Plan, Tenant, BusinessUnit."""

import uuid

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text, UniqueConstraint
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
    One row per Carmen ERP customer (company).
    The `host` column is the hostname of their Carmen instance and is the lookup key
    used when resolving incoming requests (extracted from JWT / X-Carmen-URI header).
    """

    __tablename__ = "tenants"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    host = Column(String(255), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False)
    plan = Column(String(20), ForeignKey("plans.code"), nullable=False, default="free")
    is_active = Column(Boolean, default=True, nullable=False)
    contact_email = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)

    business_units = relationship("BusinessUnit", back_populates="tenant")
    plan_ref = relationship("Plan", back_populates="tenants")


class BusinessUnit(Base, TimestampMixin, SoftDeleteMixin, WriterMixin):
    """
    A department / branch within a Tenant.
    The `code` comes from the Carmen JWT claim `bu` and is used as the lookup key.
    Unique per tenant: the same BU code may exist under different tenants.
    """

    __tablename__ = "business_units"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
    code = Column(String(100), nullable=False)
    name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    tenant = relationship("Tenant", back_populates="business_units")

    __table_args__ = (UniqueConstraint("tenant_id", "code", name="uq_bu_tenant_code"),)
