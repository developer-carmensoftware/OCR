"""Control plane — Module Registry, Bank CMS, Prompt Templates."""

import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import Enum as SAEnum

from app.database import Base

from .enums import PromptStatus, PromptType
from .mixins import SoftDeleteMixin, TimestampMixin, WriterMixin


class Module(Base, TimestampMixin):
    """
    Hub module catalog. Adding a module = INSERT row; no schema or code change required.
    module id is a natural key (e.g. 'credit_card_ocr') used as FK in many tables.
    """

    __tablename__ = "modules"

    id = Column(String(50), primary_key=True)
    display_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    sort_order = Column(Integer, default=0)


class TenantModule(Base, TimestampMixin, WriterMixin):
    """Which modules each tenant has enabled."""

    __tablename__ = "tenant_modules"

    tenant_id = Column(String(36), ForeignKey("tenants.id"), primary_key=True)
    module_id = Column(String(50), ForeignKey("modules.id"), primary_key=True)
    enabled = Column(Boolean, default=True, nullable=False)
    enabled_at = Column(DateTime, nullable=True)
    disabled_at = Column(DateTime, nullable=True)


class Bank(Base, TimestampMixin, SoftDeleteMixin, WriterMixin):
    """
    Bank registry. Replaces the old hardcoded BankType enum.
    `detection_pattern` is a regex matched against company_name from LLM output.
    Adding a bank = INSERT row + create prompt via dashboard; zero redeploy.
    """

    __tablename__ = "banks"

    code = Column(String(20), primary_key=True)
    name = Column(String(100), nullable=False)
    display_name_th = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    detection_pattern = Column(String(500), nullable=True)
    sort_order = Column(Integer, default=0)
    icon_url = Column(String(500), nullable=True)


class PromptTemplate(Base, TimestampMixin, SoftDeleteMixin, WriterMixin):
    """
    Versioned OCR/mapping/correction prompts managed via admin dashboard.
    Lifecycle: draft → published → archived.
    Only ONE published version per (bank_code, prompt_type) is active at a time.
    bank_code = NULL means a generic / combined prompt (used when bank is unknown).
    """

    __tablename__ = "prompt_templates"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    bank_code = Column(String(20), ForeignKey("banks.code"), nullable=True, index=True)
    prompt_type: Column = Column(
        SAEnum(PromptType, values_callable=lambda o: [e.value for e in o]), nullable=False
    )
    version = Column(Integer, nullable=False)
    status: Column = Column(
        SAEnum(PromptStatus, values_callable=lambda o: [e.value for e in o]),
        default=PromptStatus.DRAFT,
        nullable=False,
        index=True,
    )
    content = Column(Text, nullable=False)
    notes = Column(Text, nullable=True)
    published_at = Column(DateTime, nullable=True)
    published_by = Column(String(36), ForeignKey("admin_users.id"), nullable=True)

    __table_args__ = (
        UniqueConstraint("bank_code", "prompt_type", "version", name="uq_prompt_bank_type_version"),
    )
