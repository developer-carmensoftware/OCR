"""A bank's entries are its own, against the real dev DB.

F-8 (docs/email-automation/qa/2026-09-24-multi-bu-report.md): `20260924000000` gave an entry a
bank only where its config row named one, so carmencloud's 29 stayed bank-less and a per-bank
read missed them. The read then borrowed a bank-less entry for any field the bank lacked —
which the mapping page could not clear. `20261001000000_retire_null_bank_entries` copied them
to the banks that used them, and the read stopped borrowing: this pins the SQL for that.
"""

import pytest
from sqlalchemy import text

from app.services.credit_card.accounting_config import get_accounting_config
from tests.tenancy.conftest import session_scope

# `real_engine` / `tenants` come from conftest.py in this directory (not imported: ruff F811).

pytestmark = pytest.mark.asyncio

CARD = "บัตรเครดิต/เดบิต"


async def test_a_bank_read_sees_only_its_own_entries_and_borrows_no_bankless_ones(
    real_engine, tenants
):
    async with real_engine.begin() as conn:
        config_id = (
            await conn.execute(
                text(
                    "insert into bu_accounting_configs (tenant_id, bank_code, created_at,"
                    " updated_at) values (:t, NULL, now(), now()) returning id"
                ),
                {"t": tenants.c},
            )
        ).scalar_one()
        await conn.execute(
            text(
                "insert into bu_accounting_mapping_entries (config_id, field_type, dept_code,"
                " acc_code, is_custom, bank_code, created_at, updated_at)"
                " values (:c, :f, :d, :a, :custom, :b, now(), now())"
            ),
            [
                # pre-scoping: no bank, the BU's answer for every bank
                {"c": config_id, "f": CARD, "d": "GEN", "a": "1021009", "custom": True, "b": None},
                {
                    "c": config_id,
                    "f": "commission",
                    "d": "GEN",
                    "a": "6080008",
                    "custom": False,
                    "b": None,
                },
                # saved since: KBANK's own
                {
                    "c": config_id,
                    "f": "commission",
                    "d": "OPS",
                    "a": "5199",
                    "custom": False,
                    "b": "KBANK",
                },
            ],
        )
    try:
        with session_scope(real_engine) as factory:
            async with factory() as db:
                kbank = await get_accounting_config(db, str(tenants.c), "KBANK")
                scb = await get_accounting_config(db, str(tenants.c), "SCB")
                unscoped = await get_accounting_config(db, str(tenants.c))
                other_bu = await get_accounting_config(db, str(tenants.b), "KBANK")

        assert kbank.mappings == {"commission": {"dept": "OPS", "acc": "5199"}}  # its own only
        assert scb.mappings == {}  # nothing borrowed from the bank-less rows
        assert unscoped.mappings["commission"] == {"dept": "GEN", "acc": "6080008"}
        assert other_bu.mappings == {}  # another BU's entries never leak in
    finally:
        async with real_engine.begin() as conn:
            await conn.execute(
                text("delete from bu_accounting_mapping_entries where config_id = :c"),
                {"c": config_id},
            )
            await conn.execute(
                text("delete from bu_accounting_configs where id = :c"), {"c": config_id}
            )
