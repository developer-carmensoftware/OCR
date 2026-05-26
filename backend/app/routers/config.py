"""
User config router — persists per-BU settings that previously lived in localStorage.

  GET  /api/v1/config/accounting                    → load accounting config for current BU
  PUT  /api/v1/config/accounting                    → upsert accounting config
  GET  /api/v1/config/ap-mapping/{tax_id}           → load AP column mapping for a vendor
  PUT  /api/v1/config/ap-mapping/{tax_id}           → upsert AP column mapping for a vendor
  GET  /api/v1/config/analytics/account-usage       → which BUs use a given acc/dept code
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import SessionInfo, get_current_session
from app.database import get_db
from app.models import (
    APVendorColumnMapping,
    APVendorFieldMappingEntry,
    BUAccountingConfig,
    BUAccountingMappingEntry,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/config", tags=["Config"])

# Fixed field types that are always present (not user-added)
_FIXED_TYPES = {"commission", "tax", "net"}


# ── Schemas ───────────────────────────────────────────────────────────────────


class FieldMapping(BaseModel):
    dept: str | None = None
    acc: str | None = None


class AccountingConfigRequest(BaseModel):
    bank_code: str | None = None
    file_prefix: str | None = None
    file_source: str | None = None
    description: str | None = None
    branch: str | None = None
    mappings: dict[str, FieldMapping] | None = None
    custom_types: list[str] | None = None


class AccountingConfigResponse(BaseModel):
    bank_code: str | None = None
    file_prefix: str | None = None
    file_source: str | None = None
    description: str | None = None
    branch: str | None = None
    mappings: dict[str, Any] = {}
    custom_types: list[str] = []


# ── Helpers ───────────────────────────────────────────────────────────────────


async def _get_config(db: AsyncSession, tenant_id: str):
    result = await db.execute(
        select(BUAccountingConfig).where(
            BUAccountingConfig.tenant_id == tenant_id,
            BUAccountingConfig.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def _get_entries(db: AsyncSession, config_id: int) -> list[BUAccountingMappingEntry]:
    result = await db.execute(
        select(BUAccountingMappingEntry).where(
            BUAccountingMappingEntry.config_id == config_id,
            BUAccountingMappingEntry.deleted_at.is_(None),
        )
    )
    return result.scalars().all()


def _entries_to_response(entries: list[BUAccountingMappingEntry]) -> tuple[dict, list]:
    """Return (mappings_dict, custom_types_list) from entry rows."""
    mappings = {}
    custom_types = []
    for e in entries:
        mappings[e.field_type] = {
            "dept": e.dept_code or "",
            "acc": e.acc_code or "",
        }
        if e.is_custom:
            custom_types.append(e.field_type)
    return mappings, custom_types


# ── Accounting config endpoints ───────────────────────────────────────────────


@router.get("/accounting", response_model=AccountingConfigResponse)
async def get_accounting_config(
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    row = await _get_config(db, session.tenant_id)
    if not row:
        return AccountingConfigResponse()

    entries = await _get_entries(db, row.id)
    mappings, custom_types = _entries_to_response(entries)

    return AccountingConfigResponse(
        bank_code=row.bank_code,
        file_prefix=row.file_prefix,
        file_source=row.file_source,
        description=row.description,
        branch=row.branch,
        mappings=mappings,
        custom_types=custom_types,
    )


@router.put("/accounting")
async def save_accounting_config(
    req: AccountingConfigRequest,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    row = await _get_config(db, session.tenant_id)

    if row:
        row.bank_code = req.bank_code
        row.file_prefix = req.file_prefix
        row.file_source = req.file_source
        row.description = req.description
        row.branch = req.branch
        await db.flush()
    else:
        row = BUAccountingConfig(
            tenant_id=session.tenant_id,
            bank_code=req.bank_code,
            file_prefix=req.file_prefix,
            file_source=req.file_source,
            description=req.description,
            branch=req.branch,
        )
        db.add(row)
        await db.flush()  # populate row.id

    # Replace all mapping entries (delete + re-insert)
    await db.execute(
        delete(BUAccountingMappingEntry).where(BUAccountingMappingEntry.config_id == row.id)
    )

    custom_set = set(req.custom_types or [])
    for field_type, mapping in (req.mappings or {}).items():
        db.add(
            BUAccountingMappingEntry(
                config_id=row.id,
                field_type=field_type,
                dept_code=mapping.dept or None,
                acc_code=mapping.acc or None,
                is_custom=(field_type not in _FIXED_TYPES),
            )
        )

    # Custom types with no mapping (empty dept/acc) — ensure they exist
    for ct in custom_set:
        if ct not in (req.mappings or {}):
            db.add(
                BUAccountingMappingEntry(
                    config_id=row.id,
                    field_type=ct,
                    dept_code=None,
                    acc_code=None,
                    is_custom=True,
                )
            )

    await db.commit()
    logger.info("Saved accounting config for tenant=%s", session.tenant_id)
    return {"ok": True}


# ── AP vendor column mapping endpoints ───────────────────────────────────────


@router.get("/ap-mapping/{vendor_tax_id}")
async def get_ap_vendor_mapping(
    vendor_tax_id: str,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    result = await db.execute(
        select(APVendorColumnMapping).where(
            APVendorColumnMapping.tenant_id == session.tenant_id,
            APVendorColumnMapping.vendor_tax_id == vendor_tax_id,
            APVendorColumnMapping.deleted_at.is_(None),
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        return {"vendor_tax_id": vendor_tax_id, "mapping": None}

    entries_result = await db.execute(
        select(APVendorFieldMappingEntry).where(
            APVendorFieldMappingEntry.mapping_id == row.id,
            APVendorFieldMappingEntry.deleted_at.is_(None),
        )
    )
    mapping = {e.column_name: e.field_name for e in entries_result.scalars().all()}

    return {
        "vendor_tax_id": vendor_tax_id,
        "mapping": mapping,
    }


@router.put("/ap-mapping/{vendor_tax_id}")
async def save_ap_vendor_mapping(
    vendor_tax_id: str,
    payload: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    result = await db.execute(
        select(APVendorColumnMapping).where(
            APVendorColumnMapping.tenant_id == session.tenant_id,
            APVendorColumnMapping.vendor_tax_id == vendor_tax_id,
            APVendorColumnMapping.deleted_at.is_(None),
        )
    )
    row = result.scalar_one_or_none()

    if not row:
        row = APVendorColumnMapping(
            tenant_id=session.tenant_id,
            vendor_tax_id=vendor_tax_id,
        )
        db.add(row)
        await db.flush()  # populate row.id

    # Replace all entries (delete + re-insert)
    await db.execute(
        delete(APVendorFieldMappingEntry).where(APVendorFieldMappingEntry.mapping_id == row.id)
    )
    for column_name, field_name in payload.items():
        if not column_name or not field_name:
            continue
        db.add(
            APVendorFieldMappingEntry(
                mapping_id=row.id,
                column_name=column_name,
                field_name=str(field_name) if not isinstance(field_name, str) else field_name,
            )
        )

    await db.commit()
    logger.info("Saved AP vendor mapping for vendor=%s tenant=%s", vendor_tax_id, session.tenant_id)
    return {"ok": True}


# ── Analytics endpoints ───────────────────────────────────────────────────────


@router.get("/analytics/account-usage")
async def get_account_usage(
    acc_code: str | None = Query(None, description="Filter by GL account code"),
    dept_code: str | None = Query(None, description="Filter by department code"),
    db: AsyncSession = Depends(get_db),
    _session: SessionInfo = Depends(get_current_session),
):
    """
    Return all tenants that have a mapping entry matching the given acc_code
    and/or dept_code. At least one filter is required.

    Example: GET /api/v1/config/analytics/account-usage?acc_code=5100-00
    """
    if not acc_code and not dept_code:
        return {"error": "Provide acc_code or dept_code query param", "results": []}

    conditions = [BUAccountingMappingEntry.deleted_at.is_(None)]
    if acc_code:
        conditions.append(BUAccountingMappingEntry.acc_code == acc_code)
    if dept_code:
        conditions.append(BUAccountingMappingEntry.dept_code == dept_code)

    result = await db.execute(
        select(
            BUAccountingMappingEntry.field_type,
            BUAccountingMappingEntry.dept_code,
            BUAccountingMappingEntry.acc_code,
            BUAccountingConfig.tenant_id,
            BUAccountingConfig.bank_code,
        )
        .join(BUAccountingConfig, BUAccountingConfig.id == BUAccountingMappingEntry.config_id)
        .where(
            BUAccountingConfig.deleted_at.is_(None),
            *conditions,
        )
        .order_by(BUAccountingConfig.tenant_id)
    )
    rows = result.all()

    return {
        "acc_code": acc_code,
        "dept_code": dept_code,
        "count": len(rows),
        "results": [
            {
                "tenant_id": r.tenant_id,
                "bank_code": r.bank_code,
                "field_type": r.field_type,
                "dept_code": r.dept_code,
                "acc_code": r.acc_code,
            }
            for r in rows
        ],
    }
