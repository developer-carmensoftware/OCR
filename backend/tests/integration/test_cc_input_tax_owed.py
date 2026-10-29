"""A posted JV's input tax, after the moment that should have filed it is gone.

The wizard posts the JV on step 3 and the input-tax (ACTX) record on step 4; email files it
right after the JV. A step 4 that died or was skipped, an unticked box, or a refused filing
used to leave the VAT claim with no way back but keying it in Carmen. These pin the pieces
that close that (CA-111):

  POST /api/v1/carmen/input-tax?credit_card_id=…    stamps `input_tax_at`, refuses a second
  file_input_tax_for_card                             files it later from the card's own sums
  mark_input_tax_keyed                                "keyed in Carmen already"
  GET/POST /api/v1/credit-card/activity/{id}/input-tax[/keyed]   the queue row's dialog
"""

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.auth.session import SessionInfo
from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.models.schemas.email_automation import LateInputTaxIn
from app.services.credit_card.input_tax import file_input_tax_for_card, mark_input_tax_keyed
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
# A 15/09/2026 document seen on 29/10/2026: its claim window is September and October.
NOW = datetime(2026, 10, 29, 3, 0, tzinfo=UTC)


@pytest.fixture(autouse=True)
def _frozen_clock():
    """The claim window moves with the calendar; without this these break in April 2027."""
    with patch(f"{SVC}._now", return_value=NOW):
        yield


def _card(**overrides):
    card = SimpleNamespace(
        id=uuid.uuid4(),
        task_id=uuid.uuid4(),
        tenant_id=uuid.UUID(TENANT),
        doc_no="STMT-0915",
        doc_date=date(2026, 9, 15),
        bank_code="KBANK",
        branch_no=None,
        submitted_at=datetime(2026, 9, 15, 9, 0, tzinfo=UTC),
        commis_amt=Decimal("1000.00"),
        tax_amt=Decimal("70.00"),
        input_tax_at=None,
        input_tax_by=None,
        input_tax_keyed=False,
    )
    for k, v in overrides.items():
        setattr(card, k, v)
    return card


def _db(card):
    db = make_mock_db(execute_rows=[card] if card else [])
    db.get.return_value = KBANK
    return db


async def _file(card, post_result=None, body=None):
    db = _db(card)
    post = AsyncMock(return_value=post_result if post_result is not None else {"Code": 0})
    with (
        patch(f"{SVC}.get_accounting_config", new=AsyncMock(return_value=CONFIG)),
        patch(f"{SVC}.carmen.get_tax_profiles", new=AsyncMock(return_value=PROFILES)),
        patch(f"{SVC}.carmen.post_input_tax", new=post),
    ):
        await file_input_tax_for_card(
            db, uuid.UUID(TENANT), uuid.uuid4(), "tok", user_id="u-itx", overrides=body
        )
    return db, post


def _email_note_cleared(db) -> bool:
    """Whether an UPDATE of email_documents.error_message went to the database."""
    return any(
        "UPDATE email_documents" in str(c.args[0]) and "error_message" in str(c.args[0])
        for c in db.execute.call_args_list
    )


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
    assert card.input_tax_by == "u-itx"
    assert card.input_tax_keyed is False
    # The email row this card came from (if any) stops saying "Input tax not recorded".
    assert _email_note_cleared(db)
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_a_late_filing_may_land_in_a_later_month_of_the_window():
    """The period moves; the tax invoice date is still the document's."""
    card = _card()
    _, post = await _file(card, body=LateInputTaxIn(period="2026-10"))
    payload = post.call_args.args[0]
    assert payload["Prefix"] == "vat202610"
    assert (payload["FrDate"], payload["ToDate"]) == ("2026-10-01", "2026-10-31")
    assert payload["InvhTInvDt"] == "2026-09-15T00:00:00.000Z"


@pytest.mark.asyncio
@pytest.mark.parametrize("period", ["2026-08", "2026-11"], ids=["before-doc", "future"])
async def test_a_period_outside_the_window_is_refused_before_carmen(period):
    card = _card()
    with pytest.raises(ValidationError, match="outside this document's claim window"):
        await _file(card, body=LateInputTaxIn(period=period))
    assert card.input_tax_at is None


@pytest.mark.asyncio
async def test_past_the_six_month_window_it_can_only_be_keyed_by_hand():
    card = _card(doc_date=date(2026, 3, 31))  # March + 6 = September; it is October
    with pytest.raises(ValidationError, match="6-month"):
        await _file(card)
    assert card.input_tax_at is None


@pytest.mark.asyncio
async def test_the_dialogs_corrections_reach_the_record():
    card = _card()
    body = LateInputTaxIn(
        vendor_name="Kasikornbank Public Company Limited",
        tax_id="0107536000999",
        profile_code="VAT07",
        branch_no=" 00012 ",
    )
    _, post = await _file(card, body=body)
    payload = post.call_args.args[0]
    assert payload["VnName"] == "Kasikornbank Public Company Limited"
    assert payload["TaxId"] == "0107536000999"
    assert payload["TaxProfileCode"] == "VAT07"
    assert payload["BranchNo"] == "00012"
    # The amounts are the card's, whatever the dialog said.
    assert (payload["BfTaxAmt"], payload["TaxAmt"]) == ("1000.00", 70.0)


@pytest.mark.asyncio
async def test_a_bank_with_no_identity_files_once_a_person_supplies_one():
    """The dead end the old confirm-only button had: the dialog's two fields are the way out."""
    card = _card()
    db = _db(card)
    db.get.return_value = SimpleNamespace(code="KBANK", legal_name="", tax_id="", address="")
    post = AsyncMock(return_value={"Code": 0})
    with (
        patch(f"{SVC}.get_accounting_config", new=AsyncMock(return_value=CONFIG)),
        patch(f"{SVC}.carmen.get_tax_profiles", new=AsyncMock(return_value=PROFILES)),
        patch(f"{SVC}.carmen.post_input_tax", new=post),
    ):
        await file_input_tax_for_card(
            db,
            uuid.UUID(TENANT),
            card.id,
            "tok",
            overrides=LateInputTaxIn(vendor_name="KBank", tax_id="0107536000315"),
        )
    assert post.call_args.args[0]["TaxId"] == "0107536000315"
    assert card.input_tax_at is not None


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


# ── mark_input_tax_keyed ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_keyed_in_carmen_resolves_it_without_calling_carmen():
    card = _card()
    db = _db(card)
    post = AsyncMock()
    with patch(f"{SVC}.carmen.post_input_tax", new=post):
        await mark_input_tax_keyed(db, uuid.UUID(TENANT), card.id, "u-itx")
    post.assert_not_called()
    assert card.input_tax_at is not None
    assert (card.input_tax_by, card.input_tax_keyed) == ("u-itx", True)
    assert _email_note_cleared(db)


@pytest.mark.asyncio
async def test_keyed_in_carmen_is_still_offered_past_the_window():
    """Keying it by hand is exactly what is left once the window has closed."""
    card = _card(doc_date=date(2026, 1, 10))
    await mark_input_tax_keyed(_db(card), uuid.UUID(TENANT), card.id, "u-itx")
    assert card.input_tax_keyed is True


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "overrides",
    [
        {"input_tax_at": datetime(2026, 9, 16, tzinfo=UTC)},
        {"submitted_at": None},
        {"tax_amt": None},
    ],
    ids=["already-resolved", "not-posted", "predates-tracking"],
)
async def test_keyed_in_carmen_has_the_same_refusals(overrides):
    with pytest.raises(ConflictError):
        await mark_input_tax_keyed(_db(_card(**overrides)), uuid.UUID(TENANT), uuid.uuid4(), "u")


@pytest.mark.asyncio
async def test_keyed_in_carmen_for_another_bus_card_is_not_found():
    with pytest.raises(NotFoundError):
        await mark_input_tax_keyed(_db(None), uuid.UUID(TENANT), uuid.uuid4(), "u")


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
    assert card.input_tax_by == "u-itx"
    assert missing.status_code == 404


def test_the_dialogs_body_reaches_the_filing():
    card = _card()
    post = AsyncMock(return_value={"Code": 0})
    with (
        patch(f"{SVC}.get_accounting_config", new=AsyncMock(return_value=CONFIG)),
        patch(f"{SVC}.carmen.get_tax_profiles", new=AsyncMock(return_value=PROFILES)),
        patch(f"{SVC}.carmen.post_input_tax", new=post),
        make_test_client(_db(card), session=SESSION) as client,
    ):
        resp = client.post(
            f"/api/v1/credit-card/activity/{card.id}/input-tax",
            json={"period": "2026-10", "branch_no": "00012"},
            headers=AUTH,
        )
        bad = client.post(
            f"/api/v1/credit-card/activity/{card.id}/input-tax",
            json={"period": "2026-13"},
            headers=AUTH,
        )
    assert resp.status_code == 204
    assert post.call_args.args[0]["Prefix"] == "vat202610"
    assert post.call_args.args[0]["BranchNo"] == "00012"
    assert bad.status_code == 422


def test_the_keyed_route_answers_204_then_409():
    card = _card()
    with make_test_client(_db(card), session=SESSION) as client:
        first = client.post(f"/api/v1/credit-card/activity/{card.id}/input-tax/keyed", headers=AUTH)
        again = client.post(f"/api/v1/credit-card/activity/{card.id}/input-tax/keyed", headers=AUTH)
    assert first.status_code == 204
    assert (card.input_tax_by, card.input_tax_keyed) == ("u-itx", True)
    assert again.status_code == 409


def test_the_dialog_reads_what_it_will_file():
    card = _card(branch_no=None)
    with (
        patch(f"{SVC}.get_accounting_config", new=AsyncMock(return_value=CONFIG)),
        make_test_client(_db(card), session=SESSION) as client,
    ):
        resp = client.get(f"/api/v1/credit-card/activity/{card.id}/input-tax", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json() == {
        "owed": True,
        "doc_no": "STMT-0915",
        "doc_date": "15/09/2026",
        "bank_code": "KBANK",
        "branch_no": "00009",  # the card has none → the BU's, as the filing resolves it
        "commis_amt": 1000.0,
        "tax_amt": 70.0,
        "vendor_name": "KASIKORNBANK PCL",
        "tax_id": "0107536000315",
        "periods": ["2026-09", "2026-10"],
        "expired": False,
    }


def test_the_dialog_says_when_the_window_has_closed():
    card = _card(doc_date=date(2026, 3, 31))
    with (
        patch(f"{SVC}.get_accounting_config", new=AsyncMock(return_value=CONFIG)),
        make_test_client(_db(card), session=SESSION) as client,
    ):
        body = client.get(f"/api/v1/credit-card/activity/{card.id}/input-tax", headers=AUTH).json()
    assert (body["periods"], body["expired"]) == ([], True)


@pytest.mark.parametrize(
    ("overrides", "owed"),
    [
        ({}, True),
        ({"input_tax_at": datetime(2026, 9, 15, 10, 0, tzinfo=UTC)}, False),
        ({"tax_amt": Decimal("0")}, False),
        ({"tax_amt": None}, False),
        ({"submitted_at": None}, False),
    ],
    ids=["owed", "filed", "no-vat", "predates-tracking", "not-posted"],
)
def test_the_wizard_asks_whether_a_saved_draft_still_owes_its_record(overrides, owed):
    """The restore prompt's question (2026-10-20: a reset card's draft was offered back)."""
    card = _card(**overrides)
    with (
        patch(f"{SVC}.get_accounting_config", new=AsyncMock(return_value=CONFIG)),
        make_test_client(_db(card), session=SESSION) as client,
    ):
        resp = client.get(f"/api/v1/credit-card/activity/{card.id}/input-tax", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["owed"] is owed


def test_a_deleted_or_foreign_card_owes_nothing_the_wizard_can_restore():
    with make_test_client(_db(None), session=SESSION) as client:
        resp = client.get(f"/api/v1/credit-card/activity/{uuid.uuid4()}/input-tax", headers=AUTH)
    assert resp.status_code == 404


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
    assert card.input_tax_by == "u-itx"


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


def test_step_4_refuses_a_card_that_no_longer_exists():
    """A real card id that no longer resolves (deleted, or another BU's) is not the legacy
    no-guard path: filing it would claim VAT for a document that is gone (2026-10-20)."""
    post = AsyncMock(return_value={"Code": 0})
    with (
        patch("app.routers.carmen.post_input_tax", new=post),
        make_test_client(_db(None), session=SESSION) as client,
    ):
        resp = client.post(
            f"/api/v1/carmen/input-tax?credit_card_id={uuid.uuid4()}", json={"x": 1}, headers=AUTH
        )
    assert resp.status_code == 404
    post.assert_not_called()


@pytest.mark.parametrize("query", ["", "?credit_card_id=DOC-123"], ids=["no-id", "not-a-uuid"])
def test_step_4_without_a_card_id_is_still_the_plain_proxy(query):
    post = AsyncMock(return_value={"Code": 0})
    with (
        patch("app.routers.carmen.post_input_tax", new=post),
        make_test_client(_db(None), session=SESSION) as client,
    ):
        resp = client.post(f"/api/v1/carmen/input-tax{query}", json={"x": 1}, headers=AUTH)
    assert resp.status_code == 200
    post.assert_awaited_once()
