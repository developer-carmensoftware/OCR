"""A manual scan's input tax, after the wizard's step 4 is gone.

The wizard posts the JV on step 3 and the input-tax (ACTX) record on step 4. A session that
expired between the two used to lose the VAT claim with no trace outside a browser draft.
These pin the three pieces that close that:

  POST /api/v1/carmen/input-tax?credit_card_id=…    stamps `input_tax_at`, refuses a second
  file_input_tax_for_card                             files it later from the card's own sums
  POST /api/v1/credit-card/activity/{id}/input-tax    the queue row's button
"""

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.auth.session import SessionInfo
from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.services.credit_card.input_tax import file_input_tax_for_card
from tests.conftest import make_mock_db
from tests.integration.conftest import make_test_client

TENANT = str(uuid.uuid4())
AUTH = {"Authorization": "Bearer dummy"}
SESSION = SessionInfo(
    session_id="sess-itx",
    carmen_token="tok",
    carmen_user_id="u-itx",
    username="scanner",
    tenant_id=TENANT,
    carmen_uri="https://test.carmenwork.com",
    bu="BU01",
)
PROFILES = {"Data": [{"Code": "VAT07", "Description": "VAT 7%", "TaxRate": 7, "Active": True}]}
KBANK = SimpleNamespace(
    code="KBANK", legal_name="KASIKORNBANK PCL", tax_id="0107536000315", address="Bangkok"
)
# A description belongs to a bank and posts as saved (decision-log #32, #33): no BU-wide
# fallback, and the date appears only where the BU put the tag.
CONFIG = SimpleNamespace(
    branch="00009", bank_descriptions={"KBANK": "CC commission - {Settlement_Date}"}
)
SVC = "app.services.credit_card.input_tax"


def _card(**overrides):
    card = SimpleNamespace(
        id=uuid.uuid4(),
        tenant_id=uuid.UUID(TENANT),
        doc_no="STMT-0915",
        doc_date=date(2026, 9, 15),
        bank_code="KBANK",
        branch_no=None,
        submitted_at=datetime(2026, 9, 15, 9, 0, tzinfo=UTC),
        commis_amt=Decimal("1000.00"),
        tax_amt=Decimal("70.00"),
        input_tax_at=None,
    )
    for k, v in overrides.items():
        setattr(card, k, v)
    return card


def _db(card):
    db = make_mock_db(execute_rows=[card] if card else [])
    db.get.return_value = KBANK
    return db


async def _file(card, post_result=None):
    db = _db(card)
    post = AsyncMock(return_value=post_result if post_result is not None else {"Code": 0})
    with (
        patch(f"{SVC}.get_accounting_config", new=AsyncMock(return_value=CONFIG)),
        patch(f"{SVC}.carmen.get_tax_profiles", new=AsyncMock(return_value=PROFILES)),
        patch(f"{SVC}.carmen.post_input_tax", new=post),
    ):
        await file_input_tax_for_card(db, uuid.UUID(TENANT), uuid.uuid4(), "tok")
    return db, post


# ── file_input_tax_for_card ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_files_the_record_from_the_cards_own_sums_and_stamps_it():
    card = _card()
    db, post = await _file(card)

    payload = post.call_args.args[0]
    assert payload["BfTaxAmt"] == "1000.00"
    assert payload["TaxAmt"] == 70.0
    assert payload["InvhTInvNo"] == "STMT-0915"
    assert payload["InvhTInvDt"] == "2026-09-15T00:00:00.000Z"
    assert payload["Prefix"] == "vat202609"
    assert payload["TaxId"] == "0107536000315"
    # No branch on the card → the BU's configured branch, as the email job resolves it.
    assert payload["BranchNo"] == "00009"
    assert payload["InvhDesc"] == "CC commission - 15/09/2026"
    assert card.input_tax_at is not None
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_a_carmen_refusal_is_reported_and_leaves_it_owed():
    card = _card()
    with pytest.raises(ValidationError, match="Tax period closed"):
        await _file(card, post_result={"Code": -1, "UserMessage": "Tax period closed"})
    assert card.input_tax_at is None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("overrides", "error"),
    [
        ({"input_tax_at": datetime(2026, 9, 16, tzinfo=UTC)}, ConflictError),  # already filed
        ({"submitted_at": None}, ConflictError),  # no JV for it to follow
        ({"tax_amt": None}, ConflictError),  # posted before the sums were stored
    ],
)
async def test_refuses_before_reaching_carmen(overrides, error):
    post = AsyncMock()
    with (
        patch(f"{SVC}.carmen.post_input_tax", new=post),
        pytest.raises(error),
    ):
        await file_input_tax_for_card(
            _db(_card(**overrides)), uuid.UUID(TENANT), uuid.uuid4(), "tok"
        )
    post.assert_not_called()


@pytest.mark.asyncio
async def test_another_bus_card_is_not_found():
    """The lookup is scoped to the caller's tenant, so a foreign id simply does not match."""
    with pytest.raises(NotFoundError):
        await _file(None)


@pytest.mark.asyncio
async def test_a_record_that_cannot_be_built_says_why():
    """Same refusal the email job records: no registered identity for the bank."""
    card = _card()
    db = _db(card)
    db.get.return_value = SimpleNamespace(code="KBANK", legal_name="", tax_id="", address="")
    post = AsyncMock()
    with (
        patch(f"{SVC}.get_accounting_config", new=AsyncMock(return_value=CONFIG)),
        patch(f"{SVC}.carmen.get_tax_profiles", new=AsyncMock(return_value=PROFILES)),
        patch(f"{SVC}.carmen.post_input_tax", new=post),
        pytest.raises(ValidationError, match="Input tax not recorded"),
    ):
        await file_input_tax_for_card(db, uuid.UUID(TENANT), card.id, "tok")
    post.assert_not_called()
    assert card.input_tax_at is None


# ── The routes ───────────────────────────────────────────────────────────────


def test_the_row_button_route_answers_204_and_404():
    card = _card()
    with (
        patch(f"{SVC}.get_accounting_config", new=AsyncMock(return_value=CONFIG)),
        patch(f"{SVC}.carmen.get_tax_profiles", new=AsyncMock(return_value=PROFILES)),
        patch(f"{SVC}.carmen.post_input_tax", new=AsyncMock(return_value={"Code": 0})),
    ):
        with make_test_client(_db(card), session=SESSION) as client:
            ok = client.post(f"/api/v1/credit-card/activity/{card.id}/input-tax", headers=AUTH)
        with make_test_client(_db(None), session=SESSION) as client:
            missing = client.post(
                f"/api/v1/credit-card/activity/{uuid.uuid4()}/input-tax", headers=AUTH
            )
    assert ok.status_code == 204
    assert card.input_tax_at is not None
    assert missing.status_code == 404


def _proxy(card, result):
    post = AsyncMock(return_value=result)
    with (
        patch("app.routers.carmen.post_input_tax", new=post),
        make_test_client(_db(card), session=SESSION) as client,
    ):
        resp = client.post(
            f"/api/v1/carmen/input-tax?credit_card_id={card.id}", json={"x": 1}, headers=AUTH
        )
    return resp, post


def test_the_wizards_step_4_stamps_the_card():
    card = _card()
    resp, _ = _proxy(card, {"Code": 0})
    assert resp.status_code == 200
    assert card.input_tax_at is not None


def test_a_refused_step_4_leaves_the_card_owing():
    card = _card()
    resp, _ = _proxy(card, {"Code": -1, "UserMessage": "no"})
    assert resp.status_code == 200  # the proxy returns Carmen's verdict; the wizard reads it
    assert card.input_tax_at is None


def test_step_4_refuses_a_record_already_filed():
    """A restored draft and the queue's button can both reach the same record."""
    card = _card(input_tax_at=datetime(2026, 9, 16, tzinfo=UTC))
    resp, post = _proxy(card, {"Code": 0})
    assert resp.status_code == 409
    post.assert_not_called()
