"""Settings, mappings, and the JV a parked settlement report would post.

`jv_for_document` is the one to read first. The review screen renders what it returns and
`approve_document` posts what it returns, so it is the whole of "what reaches the customer's
books" on the human-approves path — which is the DEFAULT path, since auto_post starts false.
It had no test at all until this file; the eight ingest tests only cover the unattended one.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.constants import PostType
from app.models.schemas import ARMappingItem
from app.services import ar_reconcile_service as svc

TENANT = "11111111-1111-1111-1111-111111111111"


def _setting(**over):
    base = dict(
        id=7,
        tenant_id=TENANT,
        bank_code="KBANK",
        enabled=True,
        post_type=PostType.SUMMARY,
        jv_description_template="Credit Card AR Reconcile {Settlement_Date}",
        debit_dept_code="GEN",
        debit_account_code="1021000",
    )
    base.update(over)
    return SimpleNamespace(**base)


def _mapping(code, dept="GEN", acc="1021001", post_type=PostType.SUMMARY, is_active=True):
    return SimpleNamespace(
        post_type=post_type,
        payment_type_code=code,
        payment_type_desc=None,
        credit_dept_code=dept,
        credit_account_code=acc,
        is_active=is_active,
    )


def _result(rows):
    r = MagicMock()
    r.scalars.return_value.first.return_value = rows[0] if rows else None
    r.scalars.return_value.all.return_value = list(rows)
    # Multi-column selects (bank_options) read .all() off the result itself.
    r.all.return_value = list(rows)
    # accounting_config_service._get_config reads .scalar_one_or_none() directly, not
    # .scalars().first() — a different access pattern on the same mock result.
    r.scalar_one_or_none.return_value = rows[0] if rows else None
    return r


def _db(*result_rows):
    """A db whose successive .execute() calls return the given row lists, in order."""
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[_result(rows) for rows in result_rows])
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.add = MagicMock()
    return db


EXTRACTED = {
    "doc_no": "210726E00035291",
    "doc_date": "21/07/2026",
    "details": [
        {"transaction": "VS INTER NON-PREM", "pay_amt": "2,200.00"},
        {"transaction": "VS INTER PREM", "pay_amt": "3,251.00"},
        {"transaction": "MC INTER PREM", "pay_amt": "5,945.00"},
        {"transaction": "JCB PREM", "pay_amt": "300.00"},
    ],
    # Σ THB AMT above = 11,696.00 = commis_amt + tax_amt + total below — the same
    # self-consistency a real anchor row has to pass (decision #28).
    "total_row": {"commis_amt": "300.00", "tax_amt": "20.00", "total": "11,376.00"},
}

SUMMARY_MAPS = [_mapping("VS"), _mapping("MC", acc="1021002"), _mapping("JCB", acc="1021003")]


def _cc_entry(field_type, dept="GEN", acc="9001"):
    return SimpleNamespace(field_type=field_type, dept_code=dept, acc_code=acc, is_custom=False)


def _cc_full_mapping():
    """Two more `.execute()` results — a `BUAccountingConfig` row, then its 3 fixed
    entries — what `get_accounting_config` (`_get_config` then `_get_entries`) reads for
    the debit side. Unpack after the AR-specific rows in any `_db(...)` call that reaches
    `jv_for_document`'s commission/tax/net lookup: `_db([_setting()], MAPS, *_cc_full_mapping())`.
    """
    return [
        SimpleNamespace(
            id=9,
            bank_code=None,
            file_prefix=None,
            file_source=None,
            description=None,
            branch=None,
            bank_descriptions={},
        )
    ], [
        _cc_entry("commission", acc="5001"),
        _cc_entry("tax", acc="5002"),
        _cc_entry("net", acc="1010"),
    ]


# ── jv_for_document ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_jv_for_document_builds_the_entry_the_reviewer_approves():
    db = _db([_setting()], SUMMARY_MAPS, *_cc_full_mapping())

    out = await svc.jv_for_document(db, TENANT, "KBANK", EXTRACTED)

    assert out is not None
    assert len(out.rows) == 6, "3 fixed debit legs + VS + MC + JCB"
    debits = {r.desc: r for r in out.rows[:3]}
    assert debits["Credit card commission"].acc == "5001"
    assert debits["Credit card commission"].debit == 300.0
    assert debits["Input Tax"].acc == "5002" and debits["Input Tax"].debit == 20.0
    assert debits["Bank Account"].acc == "1010" and debits["Bank Account"].debit == 11376.0
    credits = {r.acc: r.credit for r in out.rows[3:]}
    assert credits == {"1021001": 5451.0, "1021002": 5945.0, "1021003": 300.0}
    assert out.total_debit == out.total_credit == 11696.0
    assert out.balanced is True
    assert out.unmapped == []
    assert out.description == "Credit Card AR Reconcile 21/07/2026"
    assert out.rows[3].desc.startswith("Tax Inv.# 210726E00035291 - ")


@pytest.mark.asyncio
async def test_jv_for_document_reports_a_missing_fixed_debit_mapping():
    """A JV missing its commission/tax/net GL mapping still balances and still posts —
    nothing about the arithmetic is wrong, which is why `approve_document` checks
    `unmapped` separately rather than trusting `balanced` to catch it."""
    db = _db([_setting()], SUMMARY_MAPS, [])  # no BUAccountingConfig row at all

    out = await svc.jv_for_document(db, TENANT, "KBANK", EXTRACTED)

    assert out is not None
    assert out.unmapped == ["commission", "tax", "net"]
    assert out.balanced is True


@pytest.mark.asyncio
async def test_jv_for_document_uses_the_settings_post_type_not_the_labels_on_the_page():
    """Detail and Summary are different vocabularies over the same rows. Which one applies
    is the BU's saved choice — the document looks identical either way."""
    detail_maps = [
        _mapping("VS INTER NON-PREM", post_type=PostType.DETAIL),
        _mapping("VS INTER PREM", post_type=PostType.DETAIL),
        _mapping("MC INTER PREM", acc="1021002", post_type=PostType.DETAIL),
        _mapping("JCB PREM", acc="1021003", post_type=PostType.DETAIL),
    ]
    db = _db([_setting(post_type=PostType.DETAIL)], detail_maps, *_cc_full_mapping())

    out = await svc.jv_for_document(db, TENANT, "KBANK", EXTRACTED)

    assert len(out.rows) == 7, "3 fixed debit legs + 4 printed payment types"
    assert out.balanced is True


@pytest.mark.asyncio
async def test_jv_for_document_names_the_types_that_would_block_the_post():
    db = _db([_setting()], [_mapping("VS")], *_cc_full_mapping())

    out = await svc.jv_for_document(db, TENANT, "KBANK", EXTRACTED)

    # The rows still come back — they are what the reviewer has to look at — but approve
    # refuses on this list rather than posting a leg with a blank account.
    assert sorted(out.unmapped) == ["JCB", "MC"]
    assert [r.acc for r in out.rows[3:] if not r.acc] != []
    assert out.balanced is True


@pytest.mark.asyncio
async def test_an_inactive_mapping_reads_as_unmapped_not_as_blank():
    """Inactive means "this payment type is not ours to post", which must not resolve to an
    empty dept/acc that then posts to nothing."""
    db = _db(
        [_setting()],
        [_mapping("VS"), _mapping("MC", is_active=False), _mapping("JCB")],
        *_cc_full_mapping(),
    )

    out = await svc.jv_for_document(db, TENANT, "KBANK", EXTRACTED)

    assert out.unmapped == ["MC"]


@pytest.mark.asyncio
async def test_jv_for_document_is_none_when_the_bank_was_never_configured():
    """approve_document turns this into a refusal. A BU that removed the configuration while
    a document sat in the queue must not post against a half-remembered one."""
    assert await svc.jv_for_document(_db([]), TENANT, "KBANK", EXTRACTED) is None
    assert await svc.jv_for_document(_db([]), TENANT, None, EXTRACTED) is None


@pytest.mark.asyncio
async def test_jv_for_document_survives_a_document_with_no_number():
    db = _db([_setting()], SUMMARY_MAPS, *_cc_full_mapping())
    out = await svc.jv_for_document(db, TENANT, "KBANK", {**EXTRACTED, "doc_no": ""})

    assert out.doc_no == ""
    assert out.rows[0].desc == "Credit card commission", "fixed legs never carried the prefix"
    assert out.rows[3].desc == "VS", "credit legs drop it too, when there is no number"


# ── mappings_dict ─────────────────────────────────────────────────────────────


def test_mappings_dict_drops_inactive_rows_rather_than_passing_them_through_blank():
    items = [
        ARMappingItem(payment_type_code="VS", credit_dept_code="GEN", credit_account_code="1"),
        ARMappingItem(
            payment_type_code="MC",
            credit_dept_code="GEN",
            credit_account_code="2",
            is_active=False,
        ),
    ]
    assert svc.mappings_dict(items) == {"VS": {"dept": "GEN", "acc": "1"}}


# ── get_settings on a configured BU ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_settings_returns_both_mapping_sets_for_a_configured_bank():
    rows = [_mapping("VS"), _mapping("VS INTER PREM", post_type=PostType.DETAIL)]
    # _get_setting, bank_options, _get_mappings.
    db = _db([_setting()], [], rows)

    out = await svc.get_settings(db, TENANT, "KBANK")

    assert out.enabled is True
    assert out.post_type == PostType.SUMMARY
    assert [i.payment_type_code for i in out.mappings[PostType.SUMMARY]] == ["VS"]
    assert [i.payment_type_code for i in out.mappings[PostType.DETAIL]] == ["VS INTER PREM"]


@pytest.mark.asyncio
async def test_get_settings_prefills_the_clearing_account_from_the_credit_card_mapping():
    """The lump this JV debits is the one the credit-card JV credited. Two accounts that
    disagree give an entry that balances and never zeroes the control account."""
    cfg = SimpleNamespace(id=3)
    entry = SimpleNamespace(dept_code="GEN", acc_code="1021000")
    # _get_setting (none) -> bank_options -> BUAccountingConfig -> its 'net' entry.
    db = _db([], [], [cfg], [entry])

    out = await svc.get_settings(db, TENANT, "KBANK")

    assert (out.debit_dept_code, out.debit_account_code) == ("GEN", "1021000")
    assert out.enabled is False, "prefilled, but nothing is switched on by reading it"


@pytest.mark.asyncio
async def test_a_half_filled_credit_card_mapping_prefills_nothing():
    db = _db([], [], [SimpleNamespace(id=3)], [SimpleNamespace(dept_code="GEN", acc_code=None)])

    out = await svc.get_settings(db, TENANT, "KBANK")

    assert out.debit_dept_code is None and out.debit_account_code is None


# ── save_settings ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_saving_over_an_existing_row_updates_it_rather_than_adding_a_second():
    from app.models.schemas import ARSettingsIn

    row = _setting(enabled=False, post_type=PostType.DETAIL)
    db = _db([row], [])
    req = ARSettingsIn(
        bank_code="KBANK",
        enabled=True,
        post_type=PostType.SUMMARY,
        jv_description_template="AR {Tax_Invoice_No}",
        debit_dept_code="GEN",
        debit_account_code="1021000",
        mappings={PostType.SUMMARY: [ARMappingItem(payment_type_code="VS")]},
    )

    await svc.save_settings(db, TENANT, req)

    assert row.enabled is True and row.post_type == PostType.SUMMARY
    assert row.jv_description_template == "AR {Tax_Invoice_No}"
    # One ARReconcileMapping added; the setting row was updated in place, not re-added.
    added = [type(o).__name__ for o in [c.args[0] for c in db.add.call_args_list]]
    assert added == ["ARReconcileMapping"]
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_an_empty_payment_type_code_is_not_stored():
    from app.models.schemas import ARSettingsIn

    db = _db([_setting()], [])
    await svc.save_settings(
        db,
        TENANT,
        ARSettingsIn(
            bank_code="KBANK",
            mappings={PostType.SUMMARY: [ARMappingItem(payment_type_code="   ")]},
        ),
    )
    assert db.add.call_args_list == []


# ── The bank selector (FRD §3.1 + Out-of-Scope) ───────────────────────────────


@pytest.mark.asyncio
async def test_the_selector_lists_the_phase_2_banks_and_marks_which_are_readable():
    """Both halves of this used to live in the browser, and one of them was deleted.

    FRD §3.1 lists SCB, BBL and BAY beside KBANK, and Out-of-Scope says they arrive in
    Phase 2 — so they are offered and marked, not hidden. The names come from the `banks`
    table for the same reason `list_bank_codes` exists, and `supported` comes from
    SUPPORTED_BANKS, which is the only place that knows.
    """
    res = MagicMock()
    res.all.return_value = [
        ("KBANK", "Kasikornbank"),
        ("SCB", "Siam Commercial Bank"),
        ("BBL", "Bangkok Bank"),
        ("BAY", "Krungsri"),
    ]
    db = AsyncMock()
    db.execute = AsyncMock(return_value=res)

    out = await svc.bank_options(db)

    assert [(b.code, b.supported) for b in out] == [
        ("KBANK", True),
        ("SCB", False),
        ("BBL", False),
        ("BAY", False),
    ]
    assert out[0].name == "Kasikornbank", "the name is the registry's, not a second list"


def test_the_gateways_are_not_on_the_reconciliation_roadmap():
    """KTC, GHL, PayPal and SiamPay issue processor fee invoices.

    There is no lump control account for this JV to clear, so they are not Phase 2 — they
    are not on the list at all, and offering them greyed out would promise otherwise.
    """
    assert set(svc.RECONCILABLE_BANKS).isdisjoint({"KTC", "GHL", "PAYPAL", "SIAMPAY"})
    assert set(svc.SUPPORTED_BANKS) <= set(svc.RECONCILABLE_BANKS)
