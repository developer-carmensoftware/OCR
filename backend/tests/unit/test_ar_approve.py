"""Approving a parked settlement report — the reviewer's path, and the default one.

auto_post starts false, so for most BUs this is how every AR document reaches Carmen. It
had no test until this file: the eight tests in test_ar_ingest_pipeline cover the
unattended path only, and the two differ in the one place that matters — what decides the
rows that post.

The credit-card path posts the rows the browser sent, because the browser derived them and
the reviewer may have edited a leg. This feature has no browser-side JV builder, so its
rows are rebuilt here from the BU's current mapping and the caller's are ignored. Same rule
("post what was on screen") reached the other way round: the screen displayed what
jv_for_document returned, and this rebuilds exactly that.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.exceptions import ValidationError
from app.models.schemas import ARPreviewOut, ARPreviewRow
from app.services import email_ingest_service as ingest
from tests.unit.test_email_ingest_pipeline import (
    _approve_patches,
    _extracted,
    _pending_row,
    _ReviewDB,
)


def _ar_row(**over):
    """A parked document the payload marks as a settlement report."""
    payload = {
        "extracted": {"doc_no": "210726E00035291", "doc_date": "21/07/2026", "details": []},
        "flags": [],
        "doc_type": "ar_reconcile",
    }
    payload.update(over.pop("review_payload", {}))
    return _pending_row(bank_code="KBANK", doc_no="210726E00035291", review_payload=payload, **over)


def _built(unmapped=None, balanced=True, rows=None, control_missing=False):
    rows = rows or [
        ARPreviewRow(
            dept="GEN",
            acc="1021000",
            desc="Tax Inv.# X - Credit Card AR Summary",
            debit=25091.0,
            credit=0.0,
        ),
        ARPreviewRow(dept="GEN", acc="1021001", desc="Tax Inv.# X - VS", debit=0.0, credit=25091.0),
    ]
    return ARPreviewOut(
        rows=rows,
        description="Credit Card AR Reconcile 21/07/2026",
        doc_no="210726E00035291",
        doc_date="21/07/2026",
        total_debit=sum(r.debit for r in rows),
        total_credit=sum(r.credit for r in rows),
        balanced=balanced,
        unmapped=unmapped or [],
        control_missing=control_missing,
    )


async def _approve(db, row, *, built, rows_from_client=None, carmen_result=None):
    with (
        _approve_patches(db, carmen_result=carmen_result or {"Code": 0, "InternalMessage": "JV-7"}),
        patch.object(ingest.ar_svc, "jv_for_document", AsyncMock(return_value=built)),
        patch.object(ingest, "build_gljv_payload", MagicMock(return_value={})) as build,
    ):
        result = await ingest.approve_document(
            row.id,
            tenant_id=str(row.tenant_id),
            reviewer="u-1",
            extracted=_extracted(),
            rows=rows_from_client if rows_from_client is not None else [],
        )
    return result, build


# ── What posts ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_the_rows_are_rebuilt_from_the_mapping_not_taken_from_the_client():
    row = _ar_row()
    db = _ReviewDB(row)
    junk = [{"dept": "OPS", "acc": "9999", "debit": 1_000_000.0, "credit": 0.0}]

    _, build = await _approve(db, row, built=_built(), rows_from_client=junk)

    posted = build.call_args.args[0]
    assert posted != junk, "a browser cannot hand us legs against a control account"
    assert [r["acc"] for r in posted] == ["1021000", "1021001"]
    assert sum(r["debit"] for r in posted) == sum(r["credit"] for r in posted) == 25091.0


@pytest.mark.asyncio
async def test_the_description_comes_from_this_features_template():
    row = _ar_row()
    _, build = await _approve(_ReviewDB(row), row, built=_built())

    assert build.call_args.kwargs["description"] == "Credit Card AR Reconcile 21/07/2026"


@pytest.mark.asyncio
async def test_approve_checks_the_same_duplicate_key_extraction_uses():
    """KBANK prints one tax invoice number across the fee invoice and the settlement
    report; `finalize_extraction`'s duplicate key is (doc_no, doc_date, doc_type), and
    approving must ask `has_submitted_doc` the same question — otherwise a fee invoice
    that already posted would refuse the settlement report sharing its number."""
    row = _ar_row()
    db = _ReviewDB(row)
    hsd = AsyncMock(wraps=ingest.has_submitted_doc)
    with (
        _approve_patches(db, carmen_result={"Code": 0, "InternalMessage": "JV-9"}),
        patch.object(ingest, "has_submitted_doc", hsd),
        patch.object(ingest.ar_svc, "jv_for_document", AsyncMock(return_value=_built())),
        patch.object(ingest, "build_gljv_payload", MagicMock(return_value={})),
    ):
        await ingest.approve_document(
            row.id,
            tenant_id=str(row.tenant_id),
            reviewer="u",
            extracted=_extracted(doc_date="21/07/2026"),
            rows=[],
        )
    assert hsd.call_args.kwargs["doc_type"] == "ar_reconcile"
    assert hsd.call_args.kwargs["doc_date"] is not None


@pytest.mark.asyncio
async def test_a_settlement_report_files_no_input_tax_record():
    """A reclassification claims none. The commission's VAT is claimed once, by the fee
    invoice's own document — twice would double the credit."""
    row = _ar_row()
    db = _ReviewDB(row)
    with (
        _approve_patches(db, carmen_result={"Code": 0, "InternalMessage": "JV-7"}) as p,
        patch.object(ingest.ar_svc, "jv_for_document", AsyncMock(return_value=_built())),
        patch.object(ingest, "build_gljv_payload", MagicMock(return_value={})),
    ):
        await ingest.approve_document(
            row.id, tenant_id=str(row.tenant_id), reviewer="u", extracted=_extracted(), rows=[]
        )
    p.tax.assert_not_called()


@pytest.mark.asyncio
async def test_a_fee_invoice_still_posts_the_rows_it_was_given():
    """The AR branch must not capture the path it was added beside."""
    row = _pending_row()  # no doc_type in the payload — everything parked before today
    db = _ReviewDB(row)
    edited = [{"dept": "OPS", "acc": "9999", "debit": 42.0, "credit": 0.0}]

    with (
        _approve_patches(db, carmen_result={"Code": 0, "InternalMessage": "JV-1"}),
        patch.object(ingest, "build_gljv_payload", MagicMock(return_value={})) as build,
    ):
        await ingest.approve_document(
            row.id, tenant_id=str(row.tenant_id), reviewer="u", extracted=_extracted(), rows=edited
        )

    assert build.call_args.args[0] == edited
    assert build.call_args.kwargs["description"] is None, "config-derived wording, as before"


# ── What refuses ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_approving_with_an_unmapped_type_refuses_and_names_it():
    row = _ar_row()
    db = _ReviewDB(row)

    with pytest.raises(ValidationError) as exc:
        await _approve(db, row, built=_built(unmapped=["JCB", "AMEX"]))

    assert "JCB" in str(exc.value) and "AMEX" in str(exc.value)


@pytest.mark.asyncio
async def test_a_blank_clearing_account_refuses_rather_than_posting():
    """Nothing about the arithmetic is wrong when the debit leg has no dept/acc — a JV in
    this state balances and posts — so this is the one thing standing between it and
    Carmen. (There is no `balanced` check here to be "ahead of": `built.balanced` sums the
    same grouped rows this function just built into both sides, so it cannot be False —
    see `_review_flags` in `email_ingest_service.py`.)"""
    row = _ar_row()

    with pytest.raises(ValidationError, match="clearing account"):
        await _approve(_ReviewDB(row), row, built=_built(control_missing=True))


@pytest.mark.asyncio
async def test_a_bank_whose_configuration_disappeared_while_the_document_waited():
    """A wait is exactly when someone edits settings. Posting against a half-remembered
    configuration is worse than making the reviewer look at it again."""
    row = _ar_row()

    with pytest.raises(ValidationError, match="not configured"):
        await _approve(_ReviewDB(row), row, built=None)


@pytest.mark.asyncio
async def test_nothing_reaches_carmen_when_the_entry_is_refused():
    row = _ar_row()
    db = _ReviewDB(row)

    with (
        _approve_patches(db, carmen_result={"Code": 0}) as p,
        patch.object(
            ingest.ar_svc, "jv_for_document", AsyncMock(return_value=_built(unmapped=["JCB"]))
        ),
    ):
        with pytest.raises(ValidationError):
            await ingest.approve_document(
                row.id, tenant_id=str(row.tenant_id), reviewer="u", extracted=_extracted(), rows=[]
            )

    p.post.assert_not_called()
    assert row.status == "pending_review", "still reviewable — the reviewer can fix and retry"
