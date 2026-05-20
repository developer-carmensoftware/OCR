"""
Data plane — Business tables.

All use TenantFKMixin: tenant_id + business_unit_id are NOT NULL FKs.
SoftDeleteMixin: rows are never physically deleted.
WriterMixin.created_by: stores carmen_user_id (the Carmen ERP user who acted).
"""

import uuid

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import relationship

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

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    carmen_user_id = Column(String(36), nullable=True, index=True)
    username = Column(String(100), nullable=True)
    carmen_token_encrypted = Column(Text, nullable=False)
    carmen_uri = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    last_used_at = Column(DateTime, nullable=True)


class OCRTask(Base, TenantFKMixin, TimestampMixin, SoftDeleteMixin):
    """
    Job record for every OCR upload. Parent of CreditCard and APInvoice.
    module_id: which module processed this task (FK to modules).
    """

    __tablename__ = "ocr_tasks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    module_id = Column(String(50), ForeignKey("modules.id"), nullable=False, index=True)
    original_filename = Column(String(255), nullable=False)
    status: Column = Column(
        SAEnum(TaskStatus, values_callable=lambda o: [e.value for e in o]),
        default=TaskStatus.PENDING,
        nullable=False,
    )
    ocr_engine = Column(String(100), nullable=True)
    error_message = Column(Text, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    carmen_user_id = Column(String(36), nullable=True, index=True)

    credit_card = relationship("CreditCard", back_populates="task", uselist=False)
    ap_invoice = relationship("APInvoice", back_populates="task", uselist=False)


class CreditCard(Base, TenantFKMixin, TimestampMixin, SoftDeleteMixin, WriterMixin):
    """
    Extracted data from a credit card bank statement.
    bank_code: FK to banks.code (replaces the old hardcoded BankType enum).
    Transactions are stored in CreditCardTransaction (not JSON).
    submitted_at: NULL = draft; NOT NULL = submitted to Carmen ERP.
    Duplicate check: (tenant_id, business_unit_id, bank_code, doc_no, submitted_at IS NOT NULL).
    """

    __tablename__ = "credit_cards"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id = Column(String(36), ForeignKey("ocr_tasks.id"), nullable=False, index=True)
    bank_code = Column(String(20), ForeignKey("banks.code"), nullable=True, index=True)
    company_name = Column(String(255), nullable=True)
    bank_company_name = Column(String(255), nullable=True)
    doc_date = Column(Date, nullable=True, index=True)
    doc_no = Column(String(100), nullable=True, index=True)
    branch_no = Column(String(50), nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    carmen_user_id = Column(String(36), nullable=True, index=True)

    task = relationship("OCRTask", back_populates="credit_card")
    transactions = relationship(
        "CreditCardTransaction",
        back_populates="credit_card",
        cascade="all, delete-orphan",
        order_by="CreditCardTransaction.sort_order",
    )


class CreditCardTransaction(Base, TimestampMixin, SoftDeleteMixin):
    """
    Individual line item from a credit card statement.
    Replaces the old JSON `transactions` blob on CreditCard.
    sort_order preserves the original order from the LLM output.
    """

    __tablename__ = "credit_card_transactions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    credit_card_id = Column(String(36), ForeignKey("credit_cards.id"), nullable=False, index=True)
    tx_date = Column(Date, nullable=True)
    description = Column(Text, nullable=True)
    amount = Column(Numeric(18, 4), nullable=True)
    tx_type = Column(String(50), nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)

    credit_card = relationship("CreditCard", back_populates="transactions")


class APInvoice(Base, TenantFKMixin, TimestampMixin, SoftDeleteMixin, WriterMixin):
    """
    Metadata for an AP Invoice OCR job.
    Line items are NOT stored (extract-display-only pattern) — Carmen ERP is source of truth.
    """

    __tablename__ = "ap_invoices"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id = Column(String(36), ForeignKey("ocr_tasks.id"), nullable=False, index=True)
    vendor_name = Column(String(255), nullable=True)
    doc_no = Column(String(100), nullable=True)
    doc_date = Column(Date, nullable=True, index=True)
    original_filename = Column(String(255), nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    carmen_user_id = Column(String(36), nullable=True, index=True)

    task = relationship("OCRTask", back_populates="ap_invoice")


class MappingHistory(Base, TenantFKMixin, TimestampMixin, SoftDeleteMixin, WriterMixin):
    """
    GL mapping learning: which dept/account code was confirmed for a field type + bank.
    confirmed_count is incremented each time a user confirms the same mapping.
    """

    __tablename__ = "mapping_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    bank_code = Column(String(20), ForeignKey("banks.code"), nullable=False, index=True)
    field_type = Column(String(100), nullable=False)
    dept_code = Column(String(100), nullable=True)
    acc_code = Column(String(100), nullable=True)
    confirmed_count = Column(Integer, default=1, nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "business_unit_id",
            "bank_code",
            "field_type",
            "dept_code",
            "acc_code",
            name="uq_mapping_scope_bank_field_choice",
        ),
    )


class CorrectionFeedback(Base, TenantFKMixin, TimestampMixin, SoftDeleteMixin, WriterMixin):
    """
    User correction of an LLM-extracted field.
    Used by correction_service to compute per-field error rates and inject prompt hints.
    Unique per (scope, doc_no, field_name) — latest correction wins.
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
        UniqueConstraint(
            "tenant_id",
            "business_unit_id",
            "doc_no",
            "field_name",
            name="uq_correction_scope_doc_field",
        ),
    )


class BUAccountingConfig(Base, TenantFKMixin, TimestampMixin, SoftDeleteMixin, WriterMixin):
    """
    Per-BU accounting configuration for the credit card OCR workflow.
    One active row per (tenant_id, business_unit_id).
    GL field mappings live in bu_accounting_mapping_entries (normalized for analytics).
    """

    __tablename__ = "bu_accounting_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    bank_code = Column(String(20), ForeignKey("banks.code"), nullable=True, index=True)
    file_prefix = Column(String(20), nullable=True)
    file_source = Column(String(20), nullable=True)
    description = Column(String(255), nullable=True)
    branch = Column(String(50), nullable=True)

    entries = relationship(
        "BUAccountingMappingEntry",
        back_populates="config",
        primaryjoin="and_(BUAccountingConfig.id == foreign(BUAccountingMappingEntry.config_id), "
        "BUAccountingMappingEntry.deleted_at == None)",
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "business_unit_id", name="uq_bu_accounting_config_scope"),
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
        UniqueConstraint("config_id", "field_type", name="uq_bu_mapping_entry_config_field"),
    )


class APVendorColumnMapping(Base, TenantFKMixin, TimestampMixin, SoftDeleteMixin, WriterMixin):
    """
    Per-vendor column-to-field mapping config for the AP invoice workflow.
    Replaces ap_invoice_mapping[vendorTaxId] in localStorage.
    One active row per (tenant_id, business_unit_id, vendor_tax_id).
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
        UniqueConstraint(
            "tenant_id", "business_unit_id", "vendor_tax_id", name="uq_ap_vendor_mapping_scope"
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

    id = Column(Integer, primary_key=True, autoincrement=True)
    mapping_id = Column(
        Integer, ForeignKey("ap_vendor_column_mappings.id"), nullable=False, index=True
    )
    column_name = Column(String(255), nullable=False)
    field_name = Column(String(100), nullable=False, index=True)

    mapping = relationship("APVendorColumnMapping", back_populates="entries")

    __table_args__ = (
        UniqueConstraint("mapping_id", "column_name", name="uq_ap_vendor_entry_mapping_col"),
    )
