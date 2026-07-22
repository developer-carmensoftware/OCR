"""
Unit tests for the module list on the admin Tenants page.

tenant_modules is OPT-OUT — the only writer is the admin toggle, nothing seeds it,
so "no row" means enabled. The detail endpoint used to inner-join on enabled=True,
which rendered "Modules (0) / no modules enabled" for every tenant in the pilot
even though nobody had disabled anything. These tests pin the opt-out reading so
the inner join cannot come back.

Mocked AsyncSession, direct async calls — no HTTP stack, matching the other admin tests.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from app.routers.admin.tenants import get_tenant_detail

TID = uuid.uuid4()


def _make_admin():
    admin = MagicMock()
    admin.is_global = True
    admin.tenant_scope = None
    return admin


def _catalog_row(module_id, display_name, enabled):
    """One row of the catalog ⟕ tenant_modules outer join.

    enabled is None when the tenant has no tenant_modules row at all — the common
    case, and the one the old query dropped.
    """
    r = MagicMock()
    r.id = module_id
    r.display_name = display_name
    r.enabled = enabled
    r.enabled_at = None
    return r


def _db_for(mod_rows):
    """Sequence the detail endpoint's executes: tenant lookup, modules, sessions."""
    tenant = MagicMock()
    tenant.id = TID
    tenant.host = "granddiamondsuites.carmen.blue"
    tenant.bu_code = "granddiamond"
    tenant.name = "granddiamond"
    tenant.plan = "FREE"
    tenant.is_active = True
    tenant.contact_email = None
    tenant.notes = None
    tenant.created_at = None

    tenant_res = MagicMock()
    tenant_res.scalar_one_or_none.return_value = tenant

    mod_res = MagicMock()
    mod_res.all.return_value = mod_rows

    sess_res = MagicMock()
    sess_res.scalars.return_value.all.return_value = []

    db = AsyncMock()
    db.execute.side_effect = [tenant_res, mod_res, sess_res]
    return db


async def _detail(mod_rows):
    with patch(
        "app.routers.admin.tenants.get_quota_summary",
        AsyncMock(return_value={"quotas": []}),
    ):
        return await get_tenant_detail(str(TID), db=_db_for(mod_rows), admin=_make_admin())


class TestTenantDetailModules:
    async def test_no_tenant_module_rows_means_all_enabled(self):
        # The bug: every pilot tenant has zero tenant_modules rows and showed 0 modules.
        res = await _detail(
            [
                _catalog_row("credit_card_ocr", "Credit Card OCR", None),
                _catalog_row("ap_invoice", "AP Invoice", None),
            ]
        )
        assert [m["id"] for m in res["modules"]] == ["credit_card_ocr", "ap_invoice"]
        assert res["modules_disabled"] == []

    async def test_explicit_false_row_is_the_only_thing_that_disables(self):
        res = await _detail(
            [
                _catalog_row("credit_card_ocr", "Credit Card OCR", False),
                _catalog_row("ap_invoice", "AP Invoice", None),
            ]
        )
        assert [m["id"] for m in res["modules"]] == ["ap_invoice"]
        assert res["modules_disabled"] == ["credit_card_ocr"]

    async def test_explicit_true_row_stays_enabled(self):
        res = await _detail([_catalog_row("ap_invoice", "AP Invoice", True)])
        assert [m["id"] for m in res["modules"]] == ["ap_invoice"]
        assert res["modules_disabled"] == []

    async def test_empty_catalog_reports_nothing_enabled(self):
        # The only legitimate way to reach the "no modules enabled" empty state.
        res = await _detail([])
        assert res["modules"] == []
        assert res["modules_disabled"] == []
