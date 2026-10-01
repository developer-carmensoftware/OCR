"""
Accounting config service — DB layer for per-BU accounting settings.

Encapsulates all ORM queries that were previously inline in routers/config.py.
"""

import logging
from datetime import datetime
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ConflictError, ValidationError
from app.models import (
    APVendorColumnMapping,
    APVendorFieldMappingEntry,
    BUAccountingConfig,
    BUAccountingMappingEntry,
)
from app.models.schemas import AccountingConfigRequest, AccountingConfigResponse

logger = logging.getLogger(__name__)

_FIXED_TYPES = {"commission", "tax", "net"}


class _Unscoped:
    """Sentinel: 'every bank', distinct from `bank_code=None` ('no bank set')."""


_UNSCOPED = _Unscoped()


# ── Accounting config ──────────────────────────────────────────────────────────


async def get_accounting_config(
    db: AsyncSession, tenant_id: str, bank_code: str | None = None, *, with_version: bool = False
) -> AccountingConfigResponse:
    """`with_version` is for the page that will save it back — the posting paths read the
    rules and nothing else, and do not pay a query for a token they would not use."""
    row = await _get_config(db, tenant_id)
    if not row:
        return AccountingConfigResponse()

    # Unscoped caller = "this tenant's own bank" — keeps a single-bank tenant's mappings
    # showing up exactly as before now that entries can vary per bank (see
    # 20260924000000_bank_scoped_mapping_entries.sql).
    scope = bank_code or row.bank_code
    entries = await _get_entries(db, row.id, scope)
    # A bank's entries are its own and nothing else. Until 2026-10-01 a bank-scoped read also
    # took any bank-less entry for a field the bank lacked (F-8: carmencloud's 29 never got a
    # bank), which the mapping page could not clear; 20261001000000_retire_null_bank_entries
    # copied those to the banks that used them and retired them.
    mappings, custom_types = _entries_to_response(entries)

    return AccountingConfigResponse(
        bank_code=row.bank_code,
        file_prefix=row.file_prefix,
        file_source=row.file_source,
        branch=row.branch,
        version=await _version(db, row, scope) if with_version else None,
        mappings=mappings,
        custom_types=custom_types,
        bank_descriptions=dict(row.bank_descriptions or {}),
    )


async def _version(db: AsyncSession, row: BUAccountingConfig, bank_code: str | None) -> str | None:
    """When this bank's rules last changed: the newest of the config row and the bank's own
    entries. A save that deletes and re-inserts the entries stamps the new ones, so any write
    by anyone moves this forward. The config row is BU-wide, so another bank's header save
    can too — a false alarm costs one "save anyway", a missed one costs someone's edit."""
    newest = (
        await db.execute(
            select(func.max(BUAccountingMappingEntry.updated_at)).where(
                BUAccountingMappingEntry.config_id == row.id,
                BUAccountingMappingEntry.bank_code == bank_code,
                BUAccountingMappingEntry.deleted_at.is_(None),
            )
        )
    ).scalar()
    stamps = [t for t in (getattr(row, "updated_at", None), newest) if isinstance(t, datetime)]
    return max(stamps).isoformat() if stamps else None


def description_for(config: Any, bank_code: str | None) -> str | None:
    """The description this bank's documents should carry: its own entry, or nothing.

    There is no BU-wide fallback since 2026-09-30 (decision-log #33). The old
    `description` column was read everywhere and editable nowhere, so a stray value sat
    behind every unconfigured bank; 20260930000000_description_per_bank_only copied it
    into each bank the BU used, and nothing reads the column any more.
    """
    per_bank = getattr(config, "bank_descriptions", None) or {}
    return (per_bank.get(bank_code or "") or "").strip() or None


async def save_accounting_config(
    db: AsyncSession, tenant_id: str, req: AccountingConfigRequest
) -> str | None:
    """Returns the bank's new `version`, for a page that stays open after saving."""
    row = await _get_config(db, tenant_id)

    if row and req.base_version:
        try:
            loaded = datetime.fromisoformat(req.base_version)
        except ValueError as exc:
            raise ValidationError("base_version is not a timestamp") from exc
        current = await _version(db, row, req.bank_code)
        if current and datetime.fromisoformat(current) > loaded:
            raise ConflictError(
                f"{req.bank_code or 'This'} mapping was changed after you opened it — "
                "reload it, or save again to overwrite"
            )

    if row:
        row.bank_code = req.bank_code
        row.file_prefix = req.file_prefix
        row.file_source = req.file_source
        row.branch = req.branch
        # Merged per bank, not replaced: the page edits one bank's wording, and a reviewer
        # may have corrected another's from the queue since it loaded. An empty string
        # clears that bank. Omitted = keep.
        if req.bank_descriptions is not None:
            merged = {**(row.bank_descriptions or {}), **req.bank_descriptions}
            row.bank_descriptions = {k: v for k, v in merged.items() if v}
        await db.flush()
    else:
        row = BUAccountingConfig(
            tenant_id=tenant_id,
            bank_code=req.bank_code,
            file_prefix=req.file_prefix,
            file_source=req.file_source,
            branch=req.branch,
            bank_descriptions={k: v for k, v in (req.bank_descriptions or {}).items() if v},
        )
        db.add(row)
        await db.flush()

    # Replace this bank's mapping entries only (delete + re-insert). Scoped by bank_code,
    # not config_id alone — otherwise saving bank B's payment types would delete bank A's
    # already-confirmed ones out from under it (the bug 20260924000000 fixes).
    await db.execute(
        delete(BUAccountingMappingEntry).where(
            BUAccountingMappingEntry.config_id == row.id,
            BUAccountingMappingEntry.bank_code == req.bank_code,
        )
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
                source=mapping.source or None,
                bank_code=req.bank_code,
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
                    bank_code=req.bank_code,
                )
            )

    await db.flush()
    await db.refresh(row)  # `updated_at` is stamped by the database, not by us
    version = await _version(db, row, req.bank_code)
    await db.commit()
    logger.info("Saved accounting config for tenant=%s", tenant_id)
    return version


async def fill_missing_mappings(
    db: AsyncSession, tenant_id: str, mappings: dict[str, dict[str, str]], bank_code: str | None
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
    # fill, not a value to protect. Scoped to this bank, same reasoning as
    # save_accounting_config: filling bank B's gap must not read bank A's entry.
    existing = {str(e.field_type): e for e in await _get_entries(db, row.id, bank_code)}
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
                    bank_code=bank_code,
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

    * `save_accounting_config` is a full replace — it assigns `file_prefix`, `file_source`
      and `branch` unconditionally and deletes every mapping entry before re-inserting. Sending a partial config through it wipes the rest, and two reviewers
      with the queue open is the expected case, not the edge case.
    * `fill_missing_mappings` never overwrites what the BU already set, which is exactly
      what a correction has to do.

    So: write what was named, leave every other column and entry alone. `None` means "not
    mentioned" throughout — the same idiom `save_accounting_config` already uses for
    `bank_descriptions`.

    `description` is written to **the named bank's own entry**, creating it if this BU had
    none — the only place a description lives since 2026-09-30 (`description_for`). With no
    bank known there is nowhere to write it, so it is dropped rather than parked in the
    retired BU-wide column, where nothing would ever read it back.
    """
    if not bank_code:
        description = None
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
    if description is not None and bank_code:
        # The named bank's own entry, whether or not it had one — the entry the review
        # screen edits and the only one `description_for` reads.
        row.bank_descriptions = {**(row.bank_descriptions or {}), bank_code: description}

    if not usable:
        await db.commit()
        logger.info("Patched accounting header for tenant=%s", tenant_id)
        return

    # Same bank the description branch above just resolved against — a correction made
    # about one bank's document must not read or write another bank's entry.
    entry_bank = bank_code or row.bank_code
    existing = {str(e.field_type): e for e in await _get_entries(db, row.id, entry_bank)}
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
                    bank_code=entry_bank,
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
            # The entry's own bank first — that's the bank it actually applies to since
            # 20260924000000. Falls back to the config's bank for pre-migration rows that
            # were never re-saved.
            func.coalesce(BUAccountingMappingEntry.bank_code, BUAccountingConfig.bank_code).label(
                "bank_code"
            ),
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


async def _get_entries(
    db: AsyncSession, config_id: int, bank_code: str | None | _Unscoped = _UNSCOPED
) -> list[BUAccountingMappingEntry]:
    """Entries for a config, scoped to `bank_code` unless the caller passes `_UNSCOPED`.

    `bank_code=None` is a real, meaningful filter (matches pre-migration rows with no bank
    of their own — `IS NULL`), so "give me every entry regardless of bank" needs its own
    sentinel rather than overloading `None` for both.
    """
    conditions = [
        BUAccountingMappingEntry.config_id == config_id,
        BUAccountingMappingEntry.deleted_at.is_(None),
    ]
    if bank_code is not _UNSCOPED:
        conditions.append(BUAccountingMappingEntry.bank_code == bank_code)
    result = await db.execute(select(BUAccountingMappingEntry).where(*conditions))
    return list(result.scalars().all())


def _entries_to_response(
    entries: list[BUAccountingMappingEntry],
) -> tuple[dict, list]:
    mappings: dict = {}
    custom_types: list = []
    for e in entries:
        mappings[e.field_type] = {
            "dept": e.dept_code or "",
            "acc": e.acc_code or "",
            "source": e.source,
        }
        if e.is_custom:
            custom_types.append(e.field_type)
    return mappings, custom_types
