"""Unit tests for routing: which BU a document belongs to, and which rule tells us
which bank issued it.

Routing is `email_settings_service.resolve_by_tax_ids` — the tax ID printed on the
document, not the address the mail was sent to. `match_rule` no longer identifies a
BU at all; it only picks the extraction prompt, so it is matched against every
enabled BU's rules at once.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services import email_settings_service as es
from app.services.email_ingest_service import match_rule

# ── resolve_by_tax_ids ─────────────────────────────────────────────────────────


def _row(tenant, tax_ids, rules=(), enabled=True):
    return SimpleNamespace(
        tenant_id=tenant, tax_ids=list(tax_ids), rules=list(rules), enabled=enabled
    )


def _db(rows):
    """A db whose one SELECT (enabled settings rows) answers with `rows`."""
    result = MagicMock()
    result.scalars.return_value.all.return_value = list(rows)
    db = AsyncMock()
    db.execute = AsyncMock(return_value=result)
    return db


@pytest.mark.asyncio
async def test_resolves_the_bu_whose_tax_id_is_on_the_document():
    a, b = _row("bu-a", ["0105536000127"]), _row("bu-b", ["0994000165676"])
    row = await es.resolve_by_tax_ids(_db([a, b]), ["0994000165676"])
    assert row is b


@pytest.mark.asyncio
async def test_any_one_of_several_printed_tax_ids_is_enough():
    """A document can carry the bank's tax ID as well as the hotel's."""
    a = _row("bu-a", ["0105536000127"])
    row = await es.resolve_by_tax_ids(_db([a]), ["0107537000521", "0105536000127"])
    assert row is a


@pytest.mark.asyncio
async def test_an_unknown_tax_id_routes_nowhere():
    a = _row("bu-a", ["0105536000127"])
    assert await es.resolve_by_tax_ids(_db([a]), ["9999999999999"]) is None


@pytest.mark.asyncio
async def test_a_document_with_no_tax_id_routes_nowhere():
    """Not a fallback case: with no number there is nothing to route on."""
    a = _row("bu-a", ["0105536000127"])
    assert await es.resolve_by_tax_ids(_db([a]), []) is None
    assert await es.resolve_by_tax_ids(_db([a]), ["", "  "]) is None


@pytest.mark.asyncio
async def test_a_disabled_bu_is_never_selected():
    """The query only ever asks for enabled rows — a switched-off BU cannot be routed to."""
    db = _db([])
    assert await es.resolve_by_tax_ids(db, ["0105536000127"]) is None
    assert "enabled" in str(db.execute.await_args.args[0])


# ── ingest_pool ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_pool_gathers_rules_and_passwords_across_every_enabled_bu(monkeypatch):
    """The mailbox is shared, so a file may need any BU's password and any BU's rule."""
    monkeypatch.setattr(es, "rule_passwords", lambda row: row.tax_ids)  # stand-in secrets
    a = _row("bu-a", ["pw-a"], rules=[{"bank_code": "KTC"}])
    b = _row("bu-b", ["pw-b", "pw-a"], rules=[{"bank_code": "GHL"}])

    rules, passwords = await es.ingest_pool(_db([a, b]))

    assert [r["bank_code"] for r in rules] == ["KTC", "GHL"]
    assert passwords == ["pw-a", "pw-b"]  # deduped, order preserved


# ── match_rule — a bank hint, never a BU ───────────────────────────────────────

RULES = [
    {
        "bank_code": "KTC",
        "bank_sender_email": "no-reply@ktc.co.th",
        "filename_pattern": "MDR",
        "is_active": True,
    },
    {
        "bank_code": "GHL",
        "bank_sender_email": None,
        "filename_pattern": "GHL-FEE",
        "is_active": True,
    },
    {
        "bank_code": "BBL",
        "bank_sender_email": "old@bbl.co.th",
        "filename_pattern": None,
        "is_active": False,
    },
]


def test_match_rule_sender_match_wins_over_filename():
    rule = match_rule(RULES, "no-reply@ktc.co.th", "GHL-FEE-report.pdf")
    assert rule["bank_code"] == "KTC"  # sender pass runs first, over both rules


def test_match_rule_falls_through_to_filename_pattern():
    rule = match_rule(RULES, "someone@hotelgroup.com", "monthly-GHL-FEE.pdf")
    assert rule["bank_code"] == "GHL"


def test_match_rule_inactive_rule_is_never_matched():
    # BBL's sender would match, but is_active=False excludes it.
    rule = match_rule(RULES, "old@bbl.co.th", "statement.pdf")
    assert rule is None


def test_match_rule_no_match_returns_none_for_generic_auto_detect():
    assert match_rule(RULES, "employee@hotelgroup.com", "scan001.pdf") is None


def test_match_rule_empty_rules_returns_none():
    assert match_rule([], "anyone@bank.com", "file.pdf") is None
