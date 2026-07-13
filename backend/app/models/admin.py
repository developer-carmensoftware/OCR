"""Control plane — Admin RBAC and API Keys."""

import uuid

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

from app.database import Base

from .mixins import SoftDeleteMixin, TimestampMixin, WriterMixin


class AdminUser(Base, TimestampMixin, SoftDeleteMixin, WriterMixin):
    """
    Hub admin staff. Completely separate from Carmen ERP end-users.
    First super_admin must be created via the bootstrap CLI — never seeded in migrations.
    """

    __tablename__ = "admin_users"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    mfa_secret = Column(String(64), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    last_login_ip = Column(String(45), nullable=True)
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index(
            "uq_admin_user_username_active",
            "username",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )


class Role(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "roles"

    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_system = Column(Boolean, default=False, nullable=False)


class Permission(Base, TimestampMixin):
    """id format: '{resource}:{action}' e.g. 'banks:write'"""

    __tablename__ = "permissions"

    id = Column(String(100), primary_key=True)
    name = Column(String(255), nullable=False)
    resource = Column(String(50), nullable=False, index=True)
    action = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id = Column(String(50), ForeignKey("roles.id"), primary_key=True)
    permission_id = Column(String(100), ForeignKey("permissions.id"), primary_key=True)


class AdminUserRole(Base, TimestampMixin):
    """
    Assigns a role to an admin user, optionally scoped to one tenant.

    tenant_id semantics:
      '' (empty string) → role is global (all tenants)
      <uuid>            → role is scoped to the matching tenants.id

    No FK on tenant_id because '' is a sentinel that has no corresponding
    tenants row. Validate the UUID case at the application layer.
    """

    __tablename__ = "admin_user_roles"

    user_id = Column(PGUUID(as_uuid=True), ForeignKey("admin_users.id"), primary_key=True)
    role_id = Column(String(50), ForeignKey("roles.id"), primary_key=True)
    tenant_id = Column(String(36), primary_key=True, default="", nullable=False)
    granted_by = Column(String(36), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)


class APIKey(Base, TimestampMixin, WriterMixin):
    """
    API key for external system auth.
    Plaintext key shown ONCE at creation; DB stores only the hash.
    Revocation: set revoked_at — rows are never deleted so revocation is auditable.
    """

    __tablename__ = "api_keys"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    key_prefix = Column(String(12), nullable=False, index=True)
    key_hash = Column(String(255), nullable=False)
    tenant_id = Column(PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True, index=True)
    scopes = Column(JSON, nullable=False)
    rate_limit_rpm = Column(Integer, default=60, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True, index=True)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    last_used_ip = Column(String(45), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True, index=True)
    revoked_by = Column(String(36), nullable=True)
    revoke_reason = Column(Text, nullable=True)

    usage = relationship("APIKeyUsage", back_populates="api_key")

    __table_args__ = (
        Index(
            "uq_api_key_hash_active",
            "key_hash",
            unique=True,
            postgresql_where=text("revoked_at IS NULL"),
        ),
    )


class APIKeyUsage(Base, TimestampMixin):
    """Daily aggregate of API key usage for dashboard charts."""

    __tablename__ = "api_key_usage"

    api_key_id = Column(PGUUID(as_uuid=True), ForeignKey("api_keys.id"), primary_key=True)
    usage_date = Column(Date, primary_key=True)
    calls = Column(Integer, default=0, nullable=False)
    errors = Column(Integer, default=0, nullable=False)
    tokens = Column(BigInteger, default=0, nullable=False)
    cost_usd = Column(Numeric(12, 4), default=0, nullable=False)

    api_key = relationship("APIKey", back_populates="usage")
