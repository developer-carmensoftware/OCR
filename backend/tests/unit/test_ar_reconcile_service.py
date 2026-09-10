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
}

SUMMARY_MAPS = [_mapping("VS"), _mapping("MC", acc="1021002"), _mapping("JCB", acc="1021003")]


# ── jv_for_document ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_jv_for_document_builds_the_entry_the_reviewer_approves():
    db = _db([_setting()], SUMMARY_MAPS)

    out = await svc.jv_for_document(db, TENANT, "KBANK", EXTRACTED)

    assert out is not None
    assert len(out.rows) == 4, "1 debit + VS + MC + JCB"
    assert out.rows[0].acc == "1021000" and out.rows[0].debit == 11696.0
    credits = {r.acc: r.credit for r in out.rows[1:]}
    assert credits == {"1021001": 5451.0, "1021002": 5945.0, "1021003": 300.0}
    assert out.total_debit == out.total_credit == 11696.0
    assert out.balanced is True
    assert out.unmapped == []
    assert out.description == "Credit Card AR Reconcile 21/07/2026"
    assert out.rows[1].desc.startswith("Tax Inv.# 210726E00035291 - ")


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
    db = _db([_setting(post_type=PostType.DETAIL)], detail_maps)

    out = await svc.jv_for_document(db, TENANT, "KBANK", EXTRACTED)

    assert len(out.rows) == 5, "1 debit + 4 printed payment types"
    assert out.balanced is True


@pytest.mark.asyncio
async def test_jv_for_document_names_the_types_that_would_block_the_post():
    db = _db([_setting()], [_mapping("VS")])

    out = await svc.jv_for_document(db, TENANT, "KBANK", EXTRACTED)

    # The rows still come back — they are what the reviewer has to look at — but approve
    # refuses on this list rather than posting a leg with a blank account.
    assert sorted(out.unmapped) == ["JCB", "MC"]
    assert [r.acc for r in out.rows[1:] if not r.acc] != []
    assert out.balanced is True


@pytest.mark.asyncio
async def test_an_inactive_mapping_reads_as_unmapped_not_as_blank():
    """Inactive means "this payment type is not ours to post", which must not resolve to an
    empty dept/acc that then posts to nothing."""
    db = _db([_setting()], [_mapping("VS"), _mapping("MC", is_active=False), _mapping("JCB")])

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
    db = _db([_setting()], SUMMARY_MAPS)
    out = await svc.jv_for_document(db, TENANT, "KBANK", {**EXTRACTED, "doc_no": ""})

    assert out.doc_no == ""
    assert out.rows[0].desc == "Credit Card AR Summary", "no 'Tax Inv.# ' prefix on a blank"


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
    # _get_setting, bank_options, _get_mappings, then readiness' two email-settings reads.
    db = _db([_setting()], [], rows, [], [])

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
    # _get_setting (none) -> bank_options -> BUAccountingConfig -> its 'net' entry
    # -> readiness' two reads.
    db = _db([], [], [cfg], [entry], [], [])

    out = await svc.get_settings(db, TENANT, "KBANK")

    assert (out.debit_dept_code, out.debit_account_code) == ("GEN", "1021000")
    assert out.enabled is False, "prefilled, but nothing is switched on by reading it"


@pytest.mark.asyncio
async def test_a_half_filled_credit_card_mapping_prefills_nothing():
    db = _db(
        [], [], [SimpleNamespace(id=3)], [SimpleNamespace(dept_code="GEN", acc_code=None)], [], []
    )

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


# ── readiness ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_readiness_finds_the_rule_that_would_route_this_bank():
    rule = {"bank_code": "kbank", "doc_type": "ar_reconcile", "is_active": True}
    settings_row = SimpleNamespace(rules=[rule], auto_post=True)
    db = _db([settings_row], [settings_row])

    out = await svc.readiness(
        db,
        TENANT,
        "KBANK",
        setting=_setting(),
        mappings={
            PostType.SUMMARY: [
                ARMappingItem(payment_type_code="VS", credit_dept_code="G", credit_account_code="1")
            ]
        },
    )
    by_key = {b.key: b for b in out}

    assert by_key["email_rule"].ok is True, "bank_code matched case-insensitively"
    assert by_key["feature_enabled"].ok is True
    assert by_key["mapping_complete"].ok is True
    assert by_key["auto_post"].ok is True
    assert by_key["bank_supported"].ok is True


@pytest.mark.asyncio
async def test_a_rule_for_the_other_document_type_does_not_count():
    """The commission-invoice rule and the settlement-report rule can name the same bank.
    Only one of them routes a settlement report."""
    settings_row = SimpleNamespace(
        rules=[{"bank_code": "KBANK", "doc_type": "fee_invoice", "is_active": True}],
        auto_post=False,
    )
    db = _db([settings_row], [settings_row])

    out = await svc.readiness(db, TENANT, "KBANK", setting=_setting(), mappings={})
    by_key = {b.key: b for b in out}

    assert by_key["email_rule"].ok is False
    assert by_key["auto_post"].ok is False


@pytest.mark.asyncio
async def test_an_inactive_rule_does_not_count_either():
    settings_row = SimpleNamespace(
        rules=[{"bank_code": "KBANK", "doc_type": "ar_reconcile", "is_active": False}],
        auto_post=False,
    )
    db = _db([settings_row], [settings_row])

    out = await svc.readiness(db, TENANT, "KBANK", setting=_setting(), mappings={})
    assert {b.key: b.ok for b in out}["email_rule"] is False


@pytest.mark.asyncio
async def test_an_unsupported_bank_says_so_on_the_chain():
    db = _db([None], [None])
    out = await svc.readiness(db, TENANT, "SCB", setting=None, mappings={})
    by_key = {b.key: b for b in out}

    assert by_key["bank_supported"].ok is False
    assert "KBANK" in (by_key["bank_supported"].detail or "")
    assert by_key["feature_enabled"].ok is False
    assert by_key["clearing_account"].ok is False


@pytest.mark.asyncio
async def test_a_partly_mapped_table_is_not_complete():
    settings_row = SimpleNamespace(rules=[], auto_post=False)
    db = _db([settings_row], [settings_row])

    out = await svc.readiness(
        db,
        TENANT,
        "KBANK",
        setting=_setting(),
        mappings={
            PostType.SUMMARY: [
                ARMappingItem(
                    payment_type_code="VS", credit_dept_code="G", credit_account_code="1"
                ),
                ARMappingItem(payment_type_code="MC"),
            ]
        },
    )
    by_key = {b.key: b for b in out}

    assert by_key["mapping_complete"].ok is False
    assert by_key["mapping_complete"].detail == "1 of 2 mapped"


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
