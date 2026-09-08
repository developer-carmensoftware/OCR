"""G3 / G5 — per-BU rules, and the money.

A rule switched on for one BU must be invisible to the next. These are the settings a
customer actually toggles: which modules they bought, whether they have documents left,
and whether they are in a maintenance window. Each is asserted in both directions — the
BU it was set for changes behaviour, the BU beside it does not.

The credit assertions matter twice over: a charge landing on the wrong BU is a billing
bug and an isolation bug at the same time.
"""

import io
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import text

from .conftest import AUTH, real_client, run, session_for

AP = "/api/v1/ap-invoice"

# A 1x1 PNG — enough to get past `validate_and_read`, small enough to inline.
PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
    "1f15c4890000000a49444154789c6360000002000105fe02fea7a56d0a"
    "0000000049454e44ae426082"
)


def _ctx(tenant_id):
    """Set the tenant ContextVar the services read, the way a request would."""
    from app.context import current_tenant_id

    current_tenant_id.set(str(tenant_id))


# ── Module gate ──────────────────────────────────────────────────────────────


def test_the_module_gate_answers_per_bu(real_engine, tenants):
    """AP invoice is explicitly disabled for A and enabled for B. Same call, both ways."""
    from app.exceptions import ModuleDisabled
    from app.services.module_gate import assert_module_enabled

    async def _check(tid):
        _ctx(tid)
        try:
            await assert_module_enabled("ap_invoice")
            return "allowed"
        except ModuleDisabled:
            return "blocked"

    assert run(_check(tenants.a)) == "blocked"
    assert run(_check(tenants.b)) == "allowed"
    # C has no row at all — the gate is opt-out, so absent means allowed.
    assert run(_check(tenants.c)) == "allowed"


def test_the_disabled_module_is_a_403_at_the_endpoint(tenants):
    """The gate wired up end to end: BU-A is refused before any charge or LLM call."""
    sess_a = session_for(tenants.a)
    sess_b = session_for(tenants.b, bu="bu-beta", user="user-beta")

    def _post(sess):
        # Stub the vision call: B is expected to get *past* the gate, and this suite has
        # no business spending a real LLM request (or a real document credit) to learn
        # which side of a 403 it landed on.
        with (
            patch(
                "app.routers.ap_invoice.extract_ap_invoice_data",
                new=AsyncMock(return_value={"vendorName": "stub", "items": []}),
            ),
            real_client(sess) as c,
        ):
            return c.post(
                f"{AP}/extract",
                headers=AUTH,
                files={"file": ("iso.png", io.BytesIO(PNG), "image/png")},
            )

    assert _post(sess_a).status_code == 403
    # B is past the gate. Where it lands next is not this test's business — only that
    # the gate did not stop it.
    assert _post(sess_b).status_code != 403


def test_disabling_a_module_for_one_bu_leaves_the_other_alone(real_engine, tenants):
    """Flip credit_card_ocr off for B, and confirm A still has it."""
    from app.exceptions import ModuleDisabled
    from app.services.module_gate import assert_module_enabled

    async def _check(tid):
        _ctx(tid)
        try:
            await assert_module_enabled("credit_card_ocr")
            return "allowed"
        except ModuleDisabled:
            return "blocked"

    async def _set(tid, enabled):
        async with real_engine.begin() as conn:
            await conn.execute(
                text(
                    "update tenant_modules set enabled = :e"
                    " where tenant_id = :t and module_id = 'credit_card_ocr'"
                ),
                {"e": enabled, "t": tid},
            )

    run(_set(tenants.b, False))
    try:
        assert run(_check(tenants.b)) == "blocked"
        assert run(_check(tenants.a)) == "allowed", "disabling B's module disabled A's"
    finally:
        run(_set(tenants.b, True))


# ── Credits ──────────────────────────────────────────────────────────────────


def _balances(engine, tenants):
    """(balance per tenant, docs_used per active subscription) — the two pools."""

    async def _go():
        async with engine.begin() as conn:
            rows = await conn.execute(
                text("select tenant_id, balance from tenant_credits where tenant_id = any(:ids)"),
                {"ids": tenants.all()},
            )
            bal = {str(r[0]): r[1] for r in rows}
            subs = await conn.execute(
                text(
                    "select tenant_id, docs_used from tenant_subscriptions"
                    " where tenant_id = any(:ids) and status = 'active'"
                ),
                {"ids": tenants.all()},
            )
            return bal, {str(r[0]): r[1] for r in subs}

    return run(_go())


def test_a_charge_lands_on_the_paying_bu_and_nobody_else(real_engine, tenants):
    """A is on a subscription, B on a credit balance. Charging A must move A's allowance
    and leave B's balance exactly where it was — and the other way round."""
    from app.services.credit_service import consume_document

    before_bal, before_used = _balances(real_engine, tenants)

    async def _charge(tid):
        _ctx(tid)
        return await consume_document(increment=2)

    assert run(_charge(tenants.a)) == "subscription"

    mid_bal, mid_used = _balances(real_engine, tenants)
    assert mid_used[str(tenants.a)] == before_used[str(tenants.a)] + 2
    assert mid_bal[str(tenants.b)] == before_bal[str(tenants.b)], "B paid for A's scan"
    assert mid_bal[str(tenants.c)] == before_bal[str(tenants.c)]

    assert run(_charge(tenants.b)) == "credit"

    final_bal, final_used = _balances(real_engine, tenants)
    assert final_bal[str(tenants.b)] == before_bal[str(tenants.b)] - 2
    assert final_used[str(tenants.a)] == mid_used[str(tenants.a)], "A paid for B's scan"


def test_a_bu_with_no_funding_is_refused_and_takes_nothing_from_anyone(real_engine, tenants):
    """C has a zero balance and no subscription — the 402 path."""
    from app.exceptions import InsufficientCredits
    from app.services.credit_service import consume_document

    before_bal, before_used = _balances(real_engine, tenants)

    async def _charge():
        _ctx(tenants.c)
        return await consume_document(increment=1)

    with pytest.raises(InsufficientCredits):
        run(_charge())

    after_bal, after_used = _balances(real_engine, tenants)
    assert after_bal == before_bal
    assert after_used == before_used


def test_a_refund_goes_back_to_the_bu_that_paid(real_engine, tenants):
    from app.services.credit_service import consume_document, refund_document

    before_bal, before_used = _balances(real_engine, tenants)

    async def _charge_then_refund(tid):
        _ctx(tid)
        charged = await consume_document(increment=1)
        await refund_document(charged, increment=1)

    run(_charge_then_refund(tenants.b))

    after_bal, after_used = _balances(real_engine, tenants)
    assert after_bal[str(tenants.b)] == before_bal[str(tenants.b)]
    assert after_bal[str(tenants.a)] == before_bal[str(tenants.a)]
    assert after_used[str(tenants.a)] == before_used[str(tenants.a)]


def test_no_ledger_row_lands_on_a_bu_that_never_scanned(real_engine, tenants):
    """`credit_ledger` is the audit trail behind a bill. A row on the wrong tenant is a
    charge on the wrong customer."""

    async def _counts():
        async with real_engine.begin() as conn:
            res = await conn.execute(
                text(
                    "select tenant_id, count(*) from credit_ledger"
                    " where tenant_id = any(:ids) group by tenant_id"
                ),
                {"ids": tenants.all()},
            )
            return {str(r[0]): r[1] for r in res}

    assert str(tenants.c) not in run(_counts())


# ── Maintenance mode ─────────────────────────────────────────────────────────


def test_maintenance_for_one_bu_does_not_stop_the_other(tenants):
    """Per-tenant maintenance is one of only two readers of `tenant_config_overrides`.
    The cache behind it is a single process-wide dict, so this also checks that a
    refresh triggered for A does not repaint B."""
    from app.database import async_session
    from app.services import maintenance_service as maint

    async def _set(tid, enabled):
        async with async_session() as db:
            await maint.set_tenant(db, str(tid), enabled)
            await db.commit()

    async def _is(tid):
        maint._cache["ts"] = 0.0  # force a real refresh from the DB
        return await maint.is_maintenance(str(tid))

    run(_set(tenants.a, True))
    try:
        assert run(_is(tenants.a))[0] is True
        assert run(_is(tenants.b))[0] is False, "maintenance for BU-A also stopped BU-B"
    finally:
        run(_set(tenants.a, False))
        maint._cache["ts"] = 0.0

    assert run(_is(tenants.a))[0] is False


# ── Accounting config: a full replace, per BU ────────────────────────────────


def test_one_bus_config_save_does_not_touch_the_others(real_engine, tenants):
    """`save_accounting_config` is a full replace (it DELETEs the entries and re-inserts).
    Run it for B and confirm A's row survives untouched."""
    sess_b = session_for(tenants.b, bu="bu-beta", user="user-beta")
    # snake_case: `AccountingConfigRequest` declares no aliases, so camelCase keys are
    # silently dropped and the "save" writes a row of nulls.
    body = {
        "bank_code": "GHL",
        "file_prefix": "BETA",
        "file_source": "BETASRC",
        "description": "Beta only",
        "branch": "00001",
        "mappings": {},
    }
    with real_client(sess_b) as c:
        r = c.put("/api/v1/config/accounting", headers=AUTH, json=body)
    assert r.status_code in (200, 201, 204), r.text

    async def _prefixes():
        async with real_engine.begin() as conn:
            res = await conn.execute(
                text(
                    "select tenant_id, file_prefix from bu_accounting_configs"
                    " where tenant_id = any(:ids) and deleted_at is null"
                ),
                {"ids": tenants.all()},
            )
            return {str(r[0]): r[1] for r in res}

    got = run(_prefixes())
    assert got[str(tenants.a)] == "ALPHA", "B's save overwrote A's accounting config"
    assert got[str(tenants.b)] == "BETA"
    assert str(tenants.c) not in got


def test_a_bu_with_no_config_gets_an_empty_one_not_a_neighbours(tenants):
    sess_c = session_for(tenants.c, bu="bu-alpha", user="user-c")
    with real_client(sess_c) as c:
        cfg = c.get("/api/v1/config/accounting", headers=AUTH).json()
    assert (cfg.get("filePrefix") or cfg.get("file_prefix")) in (None, "")
    assert (cfg.get("fileSource") or cfg.get("file_source")) in (None, "")
