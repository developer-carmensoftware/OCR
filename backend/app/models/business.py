"""
Data plane — Business tables.

All use TenantFKMixin: tenant_id is a NOT NULL FK to tenants (host + bu pair).
SoftDeleteMixin: rows are never physically deleted.
WriterMixin.created_by: stores carmen_user_id (the Carmen ERP user who acted).
"""

import uuid

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Integer,
    String,
    Text,
    func,
    text,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

from .enums import TaskStatus
from .mixins import SoftDeleteMixin, TenantFKMixin, TimestampMixin, WriterMixin


class OcrSession(Base, TenantFKMixin, TimestampMixin, SoftDeleteMixin):
    """
    Active session for a Carmen ERP user.
    carmen_token_encrypted: Fernet-encrypted Carmen API token, decrypted per-request.
    Session invalidation: is_active=False (set on Carmen 401) or JWT exp.
    """

    __tablename__ = "ocr_sessions"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    carmen_user_id = Column(String(36), nullable=True, index=True)
    username = Column(String(100), nullable=True)
    carmen_token_encrypted = Column(Text, nullable=False)
    carmen_uri = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    last_used_at = Column(DateTime(timezone=True), nullable=True)


class OCRTask(Base, TenantFKMixin, TimestampMixin, SoftDeleteMixin):
    """
    Job record for every OCR upload. Parent of CreditCard and APInvoice.
    module_id: which module processed this task (FK to modules).
    """

    __tablename__ = "ocr_tasks"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module_id = Column(String(50), ForeignKey("modules.id"), nullable=False, index=True)
    original_filename = Column(String(255), nullable=False)
    status: Column = Column(
        SAEnum(TaskStatus, values_callable=lambda o: [e.value for e in o]),
        default=TaskStatus.PENDING,
        nullable=False,
    )
    ocr_engine = Column(String(100), nullable=True)
    error_message = Column(Text, nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    carmen_user_id = Column(String(36), nullable=True, index=True)

    credit_card = relationship("CreditCard", back_populates="task", uselist=False)
    ap_invoice = relationship("APInvoice", back_populates="task", uselist=False)

    __table_args__ = (
        # Covers `WHERE created_at range AND deleted_at IS NULL GROUP BY module_id,
        # tenant_id, DATE(created_at)` (usage_analytics_service's get_usage_summary/
        # get_usage_totals/get_error_breakdown) — this table is never purged (5-year
        # legal retention), so it had no composite index matching that actual query
        # shape, only 5 unrelated single-column indexes. Partial on the near-universal
        # `deleted_at IS NULL` filter, matching this codebase's existing partial-index
        # convention (see Quota, PromptTemplate).
        Index(
            "ix_ocr_tasks_created_module_tenant_active",
            "created_at",
            "module_id",
            "tenant_id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )


class CreditCard(Base, TenantFKMixin, TimestampMixin, SoftDeleteMixin, WriterMixin):
    """
    Extracted data from a credit card bank statement.
    bank_code: FK to banks.code (replaces the old hardcoded BankType enum).
    submitted_at: NULL = draft; NOT NULL = submitted to Carmen ERP.
    Duplicate check: (tenant_id, bank_code, doc_no, submitted_at IS NOT NULL).
    """

    __tablename__ = "credit_cards"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(PGUUID(as_uuid=True), ForeignKey("ocr_tasks.id"), nullable=False, index=True)
    bank_code = Column(String(20), ForeignKey("banks.code"), nullable=True, index=True)
    company_name = Column(String(255), nullable=True)
    bank_company_name = Column(String(255), nullable=True)
    doc_date = Column(Date, nullable=True, index=True)
    doc_no = Column(String(100), nullable=True, index=True)
    branch_no = Column(String(50), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    carmen_user_id = Column(String(36), nullable=True, index=True)

    task = relationship("OCRTask", back_populates="credit_card")

    __table_args__ = (
        # 1:1 with ocr_tasks — partial so a soft-deleted row can be superseded.
        Index(
            "uq_credit_cards_task",
            "task_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )


class APInvoice(Base, TenantFKMixin, TimestampMixin, SoftDeleteMixin, WriterMixin):
    """
    Metadata for an AP Invoice OCR job.
    Line items are NOT stored (extract-display-only pattern) — Carmen ERP is source of truth.
    """

    __tablename__ = "ap_invoices"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(PGUUID(as_uuid=True), ForeignKey("ocr_tasks.id"), nullable=False, index=True)
    vendor_name = Column(String(255), nullable=True)
    doc_no = Column(String(100), nullable=True)
    doc_date = Column(Date, nullable=True, index=True)
    original_filename = Column(String(255), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    carmen_user_id = Column(String(36), nullable=True, index=True)

    task = relationship("OCRTask", back_populates="ap_invoice")

    __table_args__ = (
        # 1:1 with ocr_tasks — partial so a soft-deleted row can be superseded.
        Index(
            "uq_ap_invoices_task",
            "task_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )


class CorrectionFeedback(Base, TenantFKMixin, TimestampMixin, SoftDeleteMixin, WriterMixin):
    """
    User correction of an LLM-extracted field.
    Used by correction_service to compute per-field error rates and inject prompt hints.
    Unique per (tenant, bank_code, doc_no, field_name) — latest correction wins.
    """

    __tablename__ = "correction_feedback"

    id = Column(Integer, primary_key=True, autoincrement=True)
    doc_no = Column(String(100), nullable=False, index=True)
    bank_code = Column(String(20), ForeignKey("banks.code"), nullable=False, index=True)
    field_name = Column(String(100), nullable=False, index=True)
    original_value = Column(Text, nullable=True)
    corrected_value = Column(Text, nullable=True)
    carmen_user_id = Column(String(36), nullable=True, index=True)

    __table_args__ = (
        # bank_code is part of the scope: doc_no is not unique across banks.
        Index(
            "uq_correction_scope_active",
            "tenant_id",
            "bank_code",
            "doc_no",
            "field_name",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )


class BUAccountingConfig(Base, TenantFKMixin, TimestampMixin, SoftDeleteMixin, WriterMixin):
    """
    Per-tenant accounting configuration for the credit card OCR workflow.
    One active row per tenant_id (one tenant = one host+bu pair).
    GL field mappings live in bu_accounting_mapping_entries (normalized for analytics).
    """

    __tablename__ = "bu_accounting_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bank_code: Mapped[str | None] = mapped_column(
        String(20), ForeignKey("banks.code"), nullable=True, index=True
    )
    file_prefix: Mapped[str | None] = mapped_column(String(20), nullable=True)
    file_source: Mapped[str | None] = mapped_column(String(20), nullable=True)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    branch: Mapped[str | None] = mapped_column(String(50), nullable=True)

    entries = relationship(
        "BUAccountingMappingEntry",
        back_populates="config",
        primaryjoin="and_(BUAccountingConfig.id == foreign(BUAccountingMappingEntry.config_id), "
        "BUAccountingMappingEntry.deleted_at == None)",
    )

    __table_args__ = (
        Index(
            "uq_bu_accounting_config_active",
            "tenant_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )


class BUAccountingMappingEntry(Base, TimestampMixin, SoftDeleteMixin):
    """
    Individual GL mapping entry for a BU accounting config.
    Normalized so queries like 'which BUs use acc_code=5100-00' are indexed.

    field_type examples: 'commission', 'tax', 'net', 'SALES', 'CASH'
    is_custom=True  → user manually added this payment type
    is_custom=False → fixed type (commission / tax / net)
    """

    __tablename__ = "bu_accounting_mapping_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    config_id = Column(Integer, ForeignKey("bu_accounting_configs.id"), nullable=False, index=True)
    field_type = Column(String(100), nullable=False)
    dept_code = Column(String(100), nullable=True, index=True)
    acc_code = Column(String(100), nullable=True, index=True)
    is_custom = Column(Boolean, nullable=False, default=False)

    config = relationship("BUAccountingConfig", back_populates="entries")

    __table_args__ = (
        Index(
            "uq_bu_mapping_entry_active",
            "config_id",
            "field_type",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )


class APVendorColumnMapping(Base, TenantFKMixin, TimestampMixin, SoftDeleteMixin, WriterMixin):
    """
    Per-vendor column-to-field mapping config for the AP invoice workflow.
    Replaces ap_invoice_mapping[vendorTaxId] in localStorage.
    One active row per (tenant_id, vendor_tax_id).
    Field-level mappings live in ap_vendor_field_mapping_entries (normalized).
    """

    __tablename__ = "ap_vendor_column_mappings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    vendor_tax_id = Column(String(30), nullable=False, index=True)

    entries = relationship(
        "APVendorFieldMappingEntry",
        back_populates="mapping",
        primaryjoin=(
            "and_(APVendorColumnMapping.id == "
            "foreign(APVendorFieldMappingEntry.mapping_id), "
            "APVendorFieldMappingEntry.deleted_at == None)"
        ),
    )

    __table_args__ = (
        Index(
            "uq_ap_vendor_mapping_active",
            "tenant_id",
            "vendor_tax_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )


class APVendorFieldMappingEntry(Base, TimestampMixin, SoftDeleteMixin):
    """
    Individual column-to-field mapping for an AP vendor.

    column_name → source column header from the invoice (e.g. "Item Code")
    field_name  → target field in the AP invoice schema (e.g. "description")

    Normalized from the old field_mappings_json blob to mirror the pattern
    used by bu_accounting_mapping_entries (m106). Enables analytics like
    'which vendors map column X to field Y'.
    """

    __tablename__ = "ap_vendor_field_mapping_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    mapping_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("ap_vendor_column_mappings.id"), nullable=False, index=True
    )
    column_name: Mapped[str] = mapped_column(String(255), nullable=False)
    field_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    mapping = relationship("APVendorColumnMapping", back_populates="entries")

    __table_args__ = (
        Index(
            "uq_ap_vendor_entry_active",
            "mapping_id",
            "column_name",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )


class BugReport(Base, TenantFKMixin, TimestampMixin, SoftDeleteMixin, WriterMixin):
    """
    User-submitted bug report.
    Append-only in practice; status field supports admin triage workflow.
    screenshot_b64 stores a base64-encoded image (frontend caps at 1 MB).
    """

    __tablename__ = "bug_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    module_id = Column(String(50), nullable=False, index=True)
    category = Column(String(32), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(16), nullable=False, server_default="open", index=True)
    screenshot_b64 = Column(Text, nullable=True)
    screenshot_mime = Column(String(16), nullable=True)
    carmen_user_id = Column(String(36), nullable=True, index=True)


class ConsentLog(Base, TenantFKMixin):
    """
    Server-side consent record — PDPA ม.19 proof of who consented, when, which version.

    Append-only legal evidence: NO SoftDeleteMixin, NO WriterMixin (never updated,
    never deleted, never purged). Org-level consent keyed on tenant_id to match the
    frontend's tenant-scoped consent gate (useUserConsent.ts). Multiple rows per
    (tenant, version) are allowed — the history is the evidence.
    """

    __tablename__ = "consent_logs"

    id = Column(BigInteger, Identity(always=True), primary_key=True)
    carmen_user_id = Column(String(36), nullable=True)
    consent_version = Column(String(20), nullable=False)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(400), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
