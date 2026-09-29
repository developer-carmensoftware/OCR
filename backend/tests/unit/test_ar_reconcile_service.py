"""A settlement report's posting profile, and the JV a parked one would post.

`jv_for_document` is the one to read first. The review screen renders what it returns and
`approve_document` posts what it returns, so it is the whole of "what reaches the customer's
books" on the human-approves path — which is the DEFAULT path, since auto_post starts false.

Rewritten 2026-09-22 for decision #3 (docs/email-automation/06-decision-log.md #29): the
credit-side payment-type mapping this feature used to own (`ar_reconcile_mappings`, its own
table with its own `_get_mappings`/`mappings_dict(list[ARMappingItem])`) folded into
`bu_accounting_mapping_entries` — the same table `get_accounting_config` already read for
the three fixed debit legs. `jv_for_document` now makes exactly one query for mapping data
(`get_accounting_config`, one merged dict) instead of two (its own mapping table, then the
credit-card one). Everything that assumed two separate stores — `_get_mappings`, the
`ARSettingsOut.mappings` field, `ARReconcileMapping.is_active`, the clearing-account
prefill, the bank selector's own `SUPPORTED_BANKS`/`RECONCILABLE_BANKS` — is gone with it;
tests that only existed to pin those are deleted below rather than adapted, since the thing
they proved no longer exists to prove.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.constants import PostType
from app.models.schemas.common import FieldMapping
from app.services.credit_card import ar_reconcile as svc

TENANT = "11111111-1111-1111-1111-111111111111"


def _setting(**over):
    base = dict(
        id=7,
        tenant_id=TENANT,
        bank_code="KBANK",
        enabled=True,
        post_type=PostType.SUMMARY,
        jv_description_template="Credit Card AR Reconcile {Settlement_Date}",
    )
    base.update(over)
    return SimpleNamespace(**base)


def _result(rows):
    r = MagicMock()
    r.scalars.return_value.first.return_value = rows[0] if rows else None
    r.scalars.return_value.all.return_value = list(rows)
    # Multi-column selects read .all() off the result itself.
    r.all.return_value = list(rows)
    # accounting_config_service._get_config and get_settlement_grouping both read
    # .scalar_one_or_none() directly, not .scalars().first() — a different access
    # pattern on the same mock result.
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


def _entry(field_type, dept="GEN", acc="9001", is_custom=False, source=None):
    """One `BUAccountingMappingEntry` row — the single table commission/tax/net and a
    settlement report's credit-side keys share since decision #3. `source` is carried
    for completeness; the JV builder never reads it (plain string lookup only)."""
    return SimpleNamespace(
        field_type=field_type, dept_code=dept, acc_code=acc, is_custom=is_custom, source=source
    )


def _fixed_entries(commission="5001", tax="5002", net="1010"):
    return [
        _entry("commission", acc=commission),
        _entry("tax", acc=tax),
        _entry("net", acc=net),
    ]


def _summary_entries():
    return [
        _entry("VS", acc="1021001", is_custom=True, source="settlement_summary"),
        _entry("MC", acc="1021002", is_custom=True, source="settlement_summary"),
        _entry("JCB", acc="1021003", is_custom=True, source="settlement_summary"),
    ]


def _config(entries, bank_descriptions=None):
    """Three `.execute()` results — a `BUAccountingConfig` row, this bank's entries, then
    the pre-migration no-bank entries (none here) — what a bank-scoped
    `get_accounting_config` (`_get_config`, then `_get_entries` twice) reads. Pass the
    merged list `_fixed_entries() + _summary_entries()` (or a subset) since both live in
    the one table now. `bank_descriptions` is this same row's JV-wording field (Ticket D,
    2026-09-22) — a settlement JV's description now resolves from here too."""
    cfg = SimpleNamespace(
        id=9,
        bank_code=None,
        file_prefix=None,
        file_source=None,
        description=None,
        branch=None,
        bank_descriptions=bank_descriptions or {},
    )
    return [cfg], list(entries), []


def _no_config():
    """No `BUAccountingConfig` row at all — `get_accounting_config` returns an empty
    response after one query and never reaches `_get_entries`."""
    return ([],)


# ── jv_for_document ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_jv_for_document_builds_the_entry_the_reviewer_approves():
    # The description now resolves from the same bank_descriptions field the
    # fee-invoice path reads (Ticket D, 2026-09-22) — not a settlement-only template.
    db = _db(
        [_setting()],
        *_config(
            _fixed_entries() + _summary_entries(),
            bank_descriptions={"KBANK": "Credit Card AR Reconcile {Settlement_Date}"},
        ),
    )

    out = await svc.jv_for_document(db, TENANT, "KBANK", EXTRACTED)

    assert out is not None
    assert len(out.rows) == 6, "3 fixed debit legs + VS + MC + JCB"
    debits = {r.desc: r for r in out.rows[-3:]}
    assert debits["Credit card commission"].acc == "5001"
    assert debits["Credit card commission"].debit == 300.0
    assert debits["Input Tax"].acc == "5002" and debits["Input Tax"].debit == 20.0
    assert debits["Bank Account"].acc == "1010" and debits["Bank Account"].debit == 11376.0
    credits = {r.acc: r.credit for r in out.rows[:-3]}
    assert credits == {"1021001": 5451.0, "1021002": 5945.0, "1021003": 300.0}
    assert out.total_debit == out.total_credit == 11696.0
    assert out.balanced is True
    assert out.unmapped == []
    assert out.description == "Credit Card AR Reconcile 21/07/2026"
    assert out.rows[0].desc.startswith("Tax Inv.# 210726E00035291 - ")


@pytest.mark.asyncio
async def test_jv_for_document_description_falls_back_to_plain_concatenation():
    """A saved description with no template tag renders exactly as the fee-invoice
    path always has — `base - doc_date` — not the bare wording. Backward compatibility
    is the whole point of Ticket D's merge: a BU that never touches the new tags sees
    no change to their settlement JV's wording either."""
    db = _db(
        [_setting()],
        *_config(_fixed_entries() + _summary_entries(), bank_descriptions={"KBANK": "AR Recon"}),
    )

    out = await svc.jv_for_document(db, TENANT, "KBANK", EXTRACTED)

    assert out is not None
    assert out.description == "AR Recon - 21/07/2026"


@pytest.mark.asyncio
async def test_jv_for_document_description_is_empty_when_nothing_is_saved():
    db = _db([_setting()], *_config(_fixed_entries() + _summary_entries()))

    out = await svc.jv_for_document(db, TENANT, "KBANK", EXTRACTED)

    assert out is not None
    assert out.description == ""


@pytest.mark.asyncio
async def test_jv_for_document_reports_a_missing_fixed_debit_mapping():
    """A JV missing its commission/tax/net GL mapping still balances and still posts —
    nothing about the arithmetic is wrong, which is why `approve_document` checks
    `unmapped` separately rather than trusting `balanced` to catch it. Only the credit
    side (VS/MC/JCB) is configured; no commission/tax/net rows exist in the same table."""
    db = _db([_setting()], *_config(_summary_entries()))

    out = await svc.jv_for_document(db, TENANT, "KBANK", EXTRACTED)

    assert out is not None
    assert out.unmapped == ["commission", "tax", "net"]
    assert out.balanced is True


@pytest.mark.asyncio
async def test_jv_for_document_uses_the_settings_post_type_not_the_labels_on_the_page():
    """Detail and Summary are different vocabularies over the same rows. Which one applies
    is the BU's saved choice — the document looks identical either way."""
    detail_entries = _fixed_entries() + [
        _entry("VS INTER NON-PREM", acc="1021001", is_custom=True, source="settlement_detail"),
        _entry("VS INTER PREM", acc="1021001", is_custom=True, source="settlement_detail"),
        _entry("MC INTER PREM", acc="1021002", is_custom=True, source="settlement_detail"),
        _entry("JCB PREM", acc="1021003", is_custom=True, source="settlement_detail"),
    ]
    db = _db([_setting(post_type=PostType.DETAIL)], *_config(detail_entries))

    out = await svc.jv_for_document(db, TENANT, "KBANK", EXTRACTED)

    assert len(out.rows) == 7, "3 fixed debit legs + 4 printed payment types"
    assert out.balanced is True


@pytest.mark.asyncio
async def test_jv_for_document_names_the_types_that_would_block_the_post():
    entries = _fixed_entries() + [
        _entry("VS", acc="1021001", is_custom=True, source="settlement_summary")
    ]
    db = _db([_setting()], *_config(entries))

    out = await svc.jv_for_document(db, TENANT, "KBANK", EXTRACTED)

    # The rows still come back — they are what the reviewer has to look at — but approve
    # refuses on this list rather than posting a leg with a blank account.
    assert sorted(out.unmapped) == ["JCB", "MC"]
    assert [r.acc for r in out.rows[:-3] if not r.acc] != []
    assert out.balanced is True


@pytest.mark.asyncio
async def test_jv_for_document_is_none_when_the_bank_was_never_configured():
    """approve_document turns this into a refusal. A BU that removed the configuration while
    a document sat in the queue must not post against a half-remembered one."""
    assert await svc.jv_for_document(_db([]), TENANT, "KBANK", EXTRACTED) is None
    assert await svc.jv_for_document(_db([]), TENANT, None, EXTRACTED) is None


@pytest.mark.asyncio
async def test_jv_for_document_survives_a_document_with_no_number():
    db = _db([_setting()], *_config(_fixed_entries() + _summary_entries()))
    out = await svc.jv_for_document(db, TENANT, "KBANK", {**EXTRACTED, "doc_no": ""})

    assert out.doc_no == ""
    assert out.rows[-3].desc == "Credit card commission", "fixed legs never carried the prefix"
    assert out.rows[0].desc == "VS", "credit legs drop it too, when there is no number"


@pytest.mark.asyncio
async def test_jv_for_document_with_no_accounting_config_row_leaves_everything_unmapped():
    """The debit legs and the credit groups now come from the same query — if the BU has
    never saved an accounting config at all, both sides are unmapped, not just one."""
    db = _db([_setting()], *_no_config())

    out = await svc.jv_for_document(db, TENANT, "KBANK", EXTRACTED)

    assert sorted(out.unmapped) == ["JCB", "MC", "VS", "commission", "net", "tax"]


# ── mappings_dict ─────────────────────────────────────────────────────────────
#
# Reshaped 2026-09-22: this used to take `list[ARMappingItem]` (this feature's own
# mapping rows, with an `is_active` flag `BUAccountingMappingEntry` has no equivalent
# of). It now takes `dict[str, FieldMapping]` — the same shape
# `AccountingConfigResponse.mappings` already is — because `/preview` sends the merged
# mapping page's whole live state through it, not a post-type-scoped list of this
# feature's own rows.


def test_mappings_dict_converts_field_mappings_to_plain_dicts():
    items = {
        "VS": FieldMapping(dept="GEN", acc="1021001"),
        "MC": FieldMapping(dept=None, acc=None, source="settlement_summary"),
    }
    assert svc.mappings_dict(items) == {
        "VS": {"dept": "GEN", "acc": "1021001"},
        "MC": {"dept": "", "acc": ""},
    }


# ── get_settings ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_settings_returns_the_posting_profile_for_a_configured_bank():
    # _get_setting, get_settlement_grouping.
    db = _db([_setting()], ["first_token"])

    out = await svc.get_settings(db, TENANT, "KBANK")

    assert out.enabled is True
    assert out.post_type == PostType.SUMMARY
    assert out.has_settlement_layout is True


@pytest.mark.asyncio
async def test_get_settings_defaults_for_a_bank_never_saved():
    db = _db([], ["first_token"])

    out = await svc.get_settings(db, TENANT, "KBANK")

    assert out.enabled is False
    assert out.post_type == PostType.DETAIL
    assert out.has_settlement_layout is True


@pytest.mark.asyncio
async def test_get_settings_reports_no_settlement_layout_for_a_bank_that_has_none():
    db = _db([_setting(bank_code="SCB")], [])

    out = await svc.get_settings(db, TENANT, "SCB")

    assert out.has_settlement_layout is False


# ── get_settlement_grouping ───────────────────────────────────────────────────
#
# Replaces the deleted SUPPORTED_BANKS / RECONCILABLE_BANKS constants and the bank
# selector they fed (decision #8) — the merged mapping page uses its own bank list
# (constants/banks.ts, the same one the credit-card wizard always had) and reads this
# only to decide whether its Settlement card renders for the bank currently selected.


@pytest.mark.asyncio
async def test_get_settlement_grouping_reads_the_banks_table():
    db = _db(["first_token"])
    assert await svc.get_settlement_grouping(db, "KBANK") == "first_token"


@pytest.mark.asyncio
async def test_get_settlement_grouping_is_none_for_a_bank_with_no_settlement_layout():
    db = _db([])
    assert await svc.get_settlement_grouping(db, "SCB") is None


# ── save_settings ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_saving_over_an_existing_row_updates_it_rather_than_adding_a_second():
    from app.models.schemas import ARSettingsIn

    row = _setting(enabled=False, post_type=PostType.DETAIL)
    db = _db([row])
    req = ARSettingsIn(bank_code="KBANK", enabled=True, post_type=PostType.SUMMARY)

    await svc.save_settings(db, TENANT, req)

    assert row.enabled is True and row.post_type == PostType.SUMMARY
    # No mapping table of this feature's own to write to any more (decision #3) — the
    # row is updated in place and nothing is added.
    assert db.add.call_args_list == []
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_saving_a_new_bank_adds_one_row():
    from app.models.schemas import ARSettingsIn

    db = _db([])  # no existing setting for this (tenant, bank)
    req = ARSettingsIn(bank_code="KBANK", enabled=True, post_type=PostType.DETAIL)

    await svc.save_settings(db, TENANT, req)

    assert len(db.add.call_args_list) == 1
    added = db.add.call_args_list[0].args[0]
    assert added.bank_code == "KBANK" and added.enabled is True
    db.commit.assert_awaited()


def _parked(total_row=None, details=None, doc_no="X"):
    """An `EmailDocument` row shaped for `latest_real_sample` — only `review_payload`
    is read, so nothing else about the row needs to exist."""
    return SimpleNamespace(
        review_payload={
            "doc_type": "ar_reconcile",
            "extracted": {
                "doc_no": doc_no,
                "doc_date": "21/07/2026",
                "details": details
                if details is not None
                else [{"transaction": "VS", "pay_amt": "1.00"}],
                "total_row": total_row,
            },
        }
    )


class TestLatestRealSample:
    """Reads whatever this tenant's most recently parked report actually has, `total_row`
    included when it is `None` — a document parked before decision #28 (2026-09-18) never
    got one. Whether that is usable is the caller's call: `/sample-payment-types` wants the
    payment types regardless, `/preview` wants a balanceable example and falls back to its
    own hardcoded sample when this one has no anchor (see test_ar_reconcile_api.py)."""

    @pytest.mark.asyncio
    async def test_returns_the_most_recent_row_including_a_missing_total_row(self):
        db = _db([_parked(total_row=None, doc_no="OLD")])

        out = await svc.latest_real_sample(db, TENANT, "KBANK")

        assert out is not None
        _rows, doc_no, _doc_date, total_row = out
        assert doc_no == "OLD"
        assert total_row is None

    @pytest.mark.asyncio
    async def test_returns_none_when_nothing_is_parked_at_all(self):
        db = _db([])

        out = await svc.latest_real_sample(db, TENANT, "KBANK")

        assert out is None
