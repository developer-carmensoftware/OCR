"""
Accounting config service — DB layer for per-BU accounting settings.

Encapsulates all ORM queries that were previously inline in routers/config.py.
"""

import logging
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    APVendorColumnMapping,
    APVendorFieldMappingEntry,
    BUAccountingConfig,
    BUAccountingMappingEntry,
)
from app.models.schemas import AccountingConfigRequest, AccountingConfigResponse

logger = logging.getLogger(__name__)

_FIXED_TYPES = {"commission", "tax", "net"}


# ── Accounting config ──────────────────────────────────────────────────────────


async def get_accounting_config(db: AsyncSession, tenant_id: str) -> AccountingConfigResponse:
    row = await _get_config(db, tenant_id)
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
        bank_descriptions=dict(row.bank_descriptions or {}),
    )


def description_for(config: Any, bank_code: str | None) -> str | None:
    """The description this bank's documents should carry.

    A BU receiving statements from several banks can give each its own wording;
    `description` is what everything else still falls back to, so a BU that never
    sets one behaves exactly as it did before the column existed.
    """
    per_bank = getattr(config, "bank_descriptions", None) or {}
    return (per_bank.get(bank_code or "") or "").strip() or getattr(config, "description", None)


async def save_accounting_config(
    db: AsyncSession, tenant_id: str, req: AccountingConfigRequest
) -> None:
    row = await _get_config(db, tenant_id)

    if row:
        row.bank_code = req.bank_code
        row.file_prefix = req.file_prefix
        row.file_source = req.file_source
        row.description = req.description
        row.branch = req.branch
        # Omitted = keep. The wizard does not send this field yet, and it must not
        # wipe per-bank wording every time someone saves a GL mapping.
        if req.bank_descriptions is not None:
            row.bank_descriptions = {k: v for k, v in req.bank_descriptions.items() if v}
        await db.flush()
    else:
        row = BUAccountingConfig(
            tenant_id=tenant_id,
            bank_code=req.bank_code,
            file_prefix=req.file_prefix,
            file_source=req.file_source,
            description=req.description,
            branch=req.branch,
            bank_descriptions={k: v for k, v in (req.bank_descriptions or {}).items() if v},
        )
        db.add(row)
        await db.flush()

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
    logger.info("Saved accounting config for tenant=%s", tenant_id)


async def fill_missing_mappings(
    db: AsyncSession, tenant_id: str, mappings: dict[str, dict[str, str]]
) -> None:
    """Write dept/acc only where the BU has none. Never overwrites what it set.

    Additive on purpose: this is called by the email job, which runs while someone
    may have the same config open in the app. `save_accounting_config` replaces
    every entry, so using it here would delete their work between two clicks.
    """
    fillable = {k: v for k, v in mappings.items() if v.get("dept") and v.get("acc")}
    if not fillable:
        return

    row = await _get_config(db, tenant_id)
    if row is None:
        row = BUAccountingConfig(tenant_id=tenant_id)
        db.add(row)
        await db.flush()

    # A custom type can already have a row with empty dept/acc — that is a gap to
    # fill, not a value to protect.
    existing = {str(e.field_type): e for e in await _get_entries(db, row.id)}
    for field_type, mapping in fillable.items():
        entry = existing.get(field_type)
        if entry is None:
            db.add(
                BUAccountingMappingEntry(
                    config_id=row.id,
                    field_type=field_type,
                    dept_code=mapping["dept"],
                    acc_code=mapping["acc"],
                    is_custom=(field_type not in _FIXED_TYPES),
                )
            )
        elif not (entry.dept_code and entry.acc_code):
            entry.dept_code = mapping["dept"]
            entry.acc_code = mapping["acc"]

    await db.commit()
    logger.info("Filled %d GL mapping(s) for tenant=%s", len(fillable), tenant_id)


async def patch_config(
    db: AsyncSession,
    tenant_id: str,
    *,
    mappings: dict[str, dict[str, str]] | None = None,
    file_prefix: str | None = None,
    description: str | None = None,
    bank_code: str | None = None,
) -> None:
    """Write the named GL rules and header columns, overwriting, and touch nothing else.

    The third writer of this table, and it exists because neither of the other two fits a
    reviewer correcting one GL rule from the review screen:

    * `save_accounting_config` is a full replace — it assigns `file_prefix`, `file_source`,
      `description` and `branch` unconditionally and deletes every mapping entry before
      re-inserting. Sending a partial config through it wipes the rest, and two reviewers
      with the queue open is the expected case, not the edge case.
    * `fill_missing_mappings` never overwrites what the BU already set, which is exactly
      what a correction has to do.

    So: write what was named, leave every other column and entry alone. `None` means "not
    mentioned" throughout — the same idiom `save_accounting_config` already uses for
    `bank_descriptions`.

    `description` is written to **the named bank's own entry**, creating it if this BU had
    none, and only falls back to the BU-wide field when no bank is known. Two reasons, and
    they are the same ones the wizard's config editor has always had:

    * It is the field that wins at posting time — `description_for` prefers
      `bank_descriptions[bank_code]` — so writing the BU-wide one while a per-bank entry
      exists would look like the edit did nothing.
    * It is the field the caller was editing. The review screen shows this bank's own
      wording, so a correction made about one bank's documents must not silently rewrite
      every other bank's.
    """
    usable = {k: v for k, v in (mappings or {}).items() if v.get("dept") and v.get("acc")}
    if not usable and file_prefix is None and description is None:
        return

    row = await _get_config(db, tenant_id)
    if row is None:
        row = BUAccountingConfig(tenant_id=tenant_id)
        db.add(row)
        await db.flush()

    if file_prefix is not None:
        row.file_prefix = file_prefix
    if description is not None:
        if bank_code:
            # The named bank's own entry, whether or not it had one. The review screen edits
            # that entry directly (as the wizard's config editor always has), so writing the
            # BU-wide sentence instead would take a correction made about *this* bank and
            # apply it to every other one — and then read back as a placeholder rather than
            # the value that was typed. `description_for` prefers this entry, so it is also
            # the field that wins at posting time.
            row.bank_descriptions = {**(row.bank_descriptions or {}), bank_code: description}
        else:
            # No bank identified — the BU-wide fallback is the only thing this can mean.
            row.description = description

    if not usable:
        await db.commit()
        logger.info("Patched accounting header for tenant=%s", tenant_id)
        return

    existing = {str(e.field_type): e for e in await _get_entries(db, row.id)}
    for field_type, mapping in usable.items():
        entry = existing.get(field_type)
        if entry is None:
            db.add(
                BUAccountingMappingEntry(
                    config_id=row.id,
                    field_type=field_type,
                    dept_code=mapping["dept"],
                    acc_code=mapping["acc"],
                    is_custom=(field_type not in _FIXED_TYPES),
                )
            )
        else:
            entry.dept_code = mapping["dept"]
            entry.acc_code = mapping["acc"]

    await db.commit()
    logger.info("Patched %d GL mapping(s) for tenant=%s", len(usable), tenant_id)


# ── AP vendor column mapping ───────────────────────────────────────────────────


async def get_ap_vendor_mapping(
    db: AsyncSession, tenant_id: str, vendor_tax_id: str
) -> dict[str, Any] | None:
    result = await db.execute(
        select(APVendorColumnMapping).where(
            APVendorColumnMapping.tenant_id == tenant_id,
            APVendorColumnMapping.vendor_tax_id == vendor_tax_id,
            APVendorColumnMapping.deleted_at.is_(None),
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        return None

    entries_result = await db.execute(
        select(APVendorFieldMappingEntry).where(
            APVendorFieldMappingEntry.mapping_id == row.id,
            APVendorFieldMappingEntry.deleted_at.is_(None),
        )
    )
    return {e.column_name: e.field_name for e in entries_result.scalars().all()}


async def save_ap_vendor_mapping(
    db: AsyncSession, tenant_id: str, vendor_tax_id: str, payload: dict[str, Any]
) -> None:
    result = await db.execute(
        select(APVendorColumnMapping).where(
            APVendorColumnMapping.tenant_id == tenant_id,
            APVendorColumnMapping.vendor_tax_id == vendor_tax_id,
            APVendorColumnMapping.deleted_at.is_(None),
        )
    )
    row = result.scalar_one_or_none()

    if not row:
        row = APVendorColumnMapping(tenant_id=tenant_id, vendor_tax_id=vendor_tax_id)
        db.add(row)
        await db.flush()

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
    logger.info("Saved AP vendor mapping for vendor=%s tenant=%s", vendor_tax_id, tenant_id)


# ── Analytics ─────────────────────────────────────────────────────────────────


async def get_account_usage(
    db: AsyncSession, tenant_id: str, acc_code: str | None, dept_code: str | None
) -> list[dict[str, Any]]:
    # Tenant-scoped: only the caller's own GL mappings — never leak other tenants'
    # accounting structure (this endpoint was previously cross-tenant by mistake).
    conditions: list[Any] = [
        BUAccountingMappingEntry.deleted_at.is_(None),
        BUAccountingConfig.tenant_id == tenant_id,
    ]
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
        .where(BUAccountingConfig.deleted_at.is_(None), *conditions)
        .order_by(BUAccountingConfig.tenant_id)
    )
    return [
        {
            "tenant_id": r.tenant_id,
            "bank_code": r.bank_code,
            "field_type": r.field_type,
            "dept_code": r.dept_code,
            "acc_code": r.acc_code,
        }
        for r in result.all()
    ]


# ── Internal helpers ───────────────────────────────────────────────────────────


async def _get_config(db: AsyncSession, tenant_id: str) -> BUAccountingConfig | None:
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
    return list(result.scalars().all())


def _entries_to_response(
    entries: list[BUAccountingMappingEntry],
) -> tuple[dict, list]:
    mappings: dict = {}
    custom_types: list = []
    for e in entries:
        mappings[e.field_type] = {"dept": e.dept_code or "", "acc": e.acc_code or ""}
        if e.is_custom:
            custom_types.append(e.field_type)
    return mappings, custom_types
