"""F-8 against the real dev DB (docs/email-automation/qa/2026-09-24-multi-bu-report.md).

`20260924000000_bank_scoped_mapping_entries.sql` gave a mapping entry a bank only where its
config row named one. A BU whose row did not — carmencloud, all 29 entries — kept bank-less
entries that a per-bank read (`bank_code = 'KBANK'`) never matched, so every document parked
`mapping_missing`. The read now falls back to a bank-less entry for any field the bank has no
entry of its own for. The unit tests pin the merge; this pins the SQL it rests on.
"""

import pytest
from sqlalchemy import text

from app.services.credit_card.accounting_config import get_accounting_config
from tests.tenancy.conftest import session_scope

# `real_engine` / `tenants` come from conftest.py in this directory (not imported: ruff F811).

pytestmark = pytest.mark.asyncio

CARD = "บัตรเครดิต/เดบิต"


async def test_a_bank_read_sees_the_bus_bankless_entries_its_own_entries_win(real_engine, tenants):
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

        assert kbank.mappings[CARD] == {"dept": "GEN", "acc": "1021009"}  # was invisible
        assert kbank.mappings["commission"] == {"dept": "OPS", "acc": "5199"}  # bank wins
        assert scb.mappings == {
            CARD: {"dept": "GEN", "acc": "1021009"},
            "commission": {"dept": "GEN", "acc": "6080008"},
        }
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
