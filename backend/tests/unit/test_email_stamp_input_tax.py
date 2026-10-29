"""`_stamp_input_tax` — what an email document's card needs for its VAT claim to be filed
late (CA-111).

The extraction is gone once the ledger row finishes (`review_payload` is cleared), so the
card is the only place the two sums, and the document's posted number/date/branch, can
survive. These pin what is written, and that a failure never escapes: the JV it follows is
already in Carmen's books.
"""

import uuid
from contextlib import asynccontextmanager
from datetime import UTC, date, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.models.schemas import ExtractedCreditCardData
from app.models.schemas.ocr import ExtractedDetailRow
from app.services.credit_card.input_tax import owes_input_tax
from app.services.email_automation import ledger

TENANT = str(uuid.uuid4())
TASK = str(uuid.uuid4())


def _card(**over):
    card = SimpleNamespace(
        doc_no="INV-001",
        doc_date=date(2026, 9, 1),
        branch_no=None,
        submitted_at=datetime(2026, 9, 15, tzinfo=UTC),
        commis_amt=None,
        tax_amt=None,
        input_tax_at=None,
        input_tax_by=None,
    )
    card.__dict__.update(over)
    return card


def _extracted(**over):
    fields = dict(
        doc_no="INV-001",
        doc_date="15/09/2026",
        branch_no="00003",
        details=[
            ExtractedDetailRow(transaction="Visa", pay_amt="1070", commis_amt="1000", tax_amt="70"),
            ExtractedDetailRow(transaction="MC", pay_amt="535", commis_amt="500", tax_amt="35"),
        ],
    )
    fields.update(over)
    return ExtractedCreditCardData(**fields)


async def _stamp(card, extracted, details=None, **kw):
    db = SimpleNamespace(scalar=AsyncMock(return_value=card), commit=AsyncMock())

    @asynccontextmanager
    async def _session():
        yield db

    with patch.object(ledger, "async_session", _session):
        await ledger._stamp_input_tax(TENANT, TASK, extracted, details, **kw)
    return db


@pytest.mark.asyncio
async def test_a_filed_claim_stamps_the_sums_and_the_filing():
    card = _card()
    db = await _stamp(card, _extracted(), filed=True, by="u-reviewer")
    assert (card.commis_amt, card.tax_amt) == (1500.0, 105.0)
    assert card.input_tax_at is not None
    assert card.input_tax_by == "u-reviewer"
    assert not owes_input_tax(card)
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_an_unfiled_claim_is_left_owing():
    """Refused, failed, or a reviewer who unticked the box — the queue row offers to file it."""
    card = _card()
    await _stamp(card, _extracted(), filed=False)
    assert card.tax_amt == 105.0
    assert card.input_tax_at is None
    assert owes_input_tax(card)


@pytest.mark.asyncio
async def test_no_vat_stamps_the_sums_and_is_neither_filed_nor_owed():
    """`_post_input_tax` returns None for "no VAT" as well as for "filed"; the sums tell
    them apart, so a document with nothing to claim is never marked as having claimed it."""
    card = _card()
    no_vat = [ExtractedDetailRow(transaction="Visa", pay_amt="1000", commis_amt="0", tax_amt="0")]
    await _stamp(card, _extracted(details=no_vat), filed=True)
    assert (card.commis_amt, card.tax_amt) == (0.0, 0.0)
    assert card.input_tax_at is None
    assert not owes_input_tax(card)


@pytest.mark.asyncio
async def test_the_settlement_reports_total_row_is_what_gets_summed():
    card = _card()
    total_row = ExtractedDetailRow(commis_amt="582.99", tax_amt="40.81", total="24467.20")
    await _stamp(card, _extracted(), [total_row], filed=False)
    assert (card.commis_amt, card.tax_amt) == (582.99, 40.81)


@pytest.mark.asyncio
async def test_the_card_takes_the_document_as_it_was_posted():
    """A reviewer's corrections never reached the card, and the claim window is measured
    from its date — the extracted 01/09 would have closed it a month early."""
    card = _card()
    await _stamp(card, _extracted(), filed=False)
    assert card.doc_date == date(2026, 9, 15)
    assert card.branch_no == "00003"


@pytest.mark.asyncio
async def test_a_database_failure_is_swallowed():
    db = SimpleNamespace(scalar=AsyncMock(side_effect=RuntimeError("db down")), commit=AsyncMock())

    @asynccontextmanager
    async def _session():
        yield db

    with patch.object(ledger, "async_session", _session):
        await ledger._stamp_input_tax(TENANT, TASK, _extracted(), filed=True)  # no raise
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_no_task_and_no_card_are_quiet_no_ops():
    """A duplicate never got a card; a row with no task never reached extraction."""
    await ledger._stamp_input_tax(TENANT, None, _extracted(), filed=True)
    db = await _stamp(None, _extracted(), filed=True)
    db.commit.assert_not_awaited()
