"""Unit tests for routing: which BU a document belongs to, and which rule lets it be
extracted at all.

Routing is the `+tag` in the address the mail was **delivered to**
(`email_ingest_service.tag_from_recipients` → `email_settings_service.resolve_by_tag`),
read from the envelope before anything is extracted. The tax ID printed on the document
is a second, independent check (`foreign_tax_id`) applied afterwards.

`match_rules` still identifies a bank rather than a BU, but it is no longer only a hint:
an attachment no rule claims is never sent to the LLM.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services import email_imap as imap
from app.services import email_ingest_service as ingest
from app.services import email_settings_service as es
from app.services.email_ingest_service import (
    gmail_confirm_code,
    match_rules,
    sender_allowed,
    tag_from_recipients,
)

ADDRESS = "AIAGENT@carmensoftware.com"


@pytest.fixture(autouse=True)
def _pin_mailbox(monkeypatch):
    """The mailbox is env-configured (a dev .env points it at a personal inbox), so pin
    it — otherwise these tests pass or fail depending on whose machine they run on."""
    monkeypatch.setattr(ingest.settings, "email_ingest_address", ADDRESS)
    monkeypatch.setattr(es.app_settings, "email_ingest_address", ADDRESS)


def _row(tenant, tax_ids=(), rules=(), enabled=True, tag="a1b2c3d4"):
    return SimpleNamespace(
        tenant_id=tenant,
        tax_ids=list(tax_ids),
        rules=list(rules),
        enabled=enabled,
        ingest_tag=tag,
    )


def _db(rows=(), one=None):
    """A db whose one SELECT answers with `rows` (.scalars().all()) or `one`."""
    result = MagicMock()
    result.scalars.return_value.all.return_value = list(rows)
    result.scalar_one_or_none.return_value = one
    db = AsyncMock()
    db.execute = AsyncMock(return_value=result)
    return db


# ── tag_from_recipients — the envelope, never `To:` ────────────────────────────


def test_the_tag_is_read_from_delivered_to():
    assert tag_from_recipients(["AIAGENT+a1b2c3d4@carmensoftware.com"]) == "a1b2c3d4"


def test_the_tag_is_found_inside_a_full_delivered_to_line():
    """Real headers are not bare addresses."""
    header = "for <AIAGENT+a1b2c3d4@carmensoftware.com>; Wed, 6 Aug 2026 09:00:00 -0700"
    assert tag_from_recipients([header]) == "a1b2c3d4"


def test_the_tag_is_case_insensitive_and_normalised():
    assert tag_from_recipients(["AIAGENT+DEADBEEF@CARMENSOFTWARE.COM"]) == "deadbeef"


def test_a_multi_hop_forward_takes_the_first_matching_delivered_to():
    """Several Delivered-To headers; only ours can produce a tag."""
    values = [
        "accounts@hotelgroup.com",
        "AIAGENT+a1b2c3d4@carmensoftware.com",
        "AIAGENT+ffffffff@carmensoftware.com",
    ]
    assert tag_from_recipients(values) == "a1b2c3d4"


def test_the_bare_address_yields_no_tag():
    """Mail to the untagged mailbox belongs to nobody — it is never shown to anyone."""
    assert tag_from_recipients(["AIAGENT@carmensoftware.com"]) is None


def test_another_domains_plus_address_is_not_our_tag():
    assert tag_from_recipients(["AIAGENT+a1b2c3d4@example.com"]) is None
    assert tag_from_recipients(["someoneelse+a1b2c3d4@carmensoftware.com"]) is None


def test_no_delivery_headers_at_all_yields_no_tag():
    assert tag_from_recipients([]) is None


# ── _recipients — which headers the tag may come from ──────────────────────────
#
# The shapes below are copied from real deliveries measured against the dev mailbox on
# 2026-08-06, because the assumption underneath this whole feature turned out to be
# wrong in one of them.


def _msg(raw_headers: str):
    import email as _email

    return _email.message_from_string(raw_headers + "\n\n(body)\n")


def test_the_tag_comes_from_delivered_to():
    msg = _msg(
        "From: no-reply@ktc.co.th\n"
        "To: accounts@hotelgroup.com\n"
        "Delivered-To: AIAGENT+a1b2c3d4@carmensoftware.com\n"
    )
    assert tag_from_recipients(imap._recipients(msg)) == "a1b2c3d4"


def test_the_tag_is_found_when_gmail_omits_delivered_to_entirely():
    """Measured, not assumed. Gmail stamps **no** `Delivered-To` when sender and
    recipient are the same account: the mail is accepted at submission (`ESMTPSA`) and
    never traverses the inbound MX hop that adds it. The envelope recipient is still in
    the `Received … for` clause, which is why that is read as well.

    This exact shape returned `None` — i.e. the mail would have been dropped as
    unrouted — before the fallback existed.
    """
    msg = _msg(
        "Return-Path: <boonyawat.asu@gmail.com>\n"
        "Received: from [192.168.11.55] ([184.82.209.128]) by smtp.gmail.com with\n"
        " ESMTPSA id d2e1a72fcca58-84f453bab29sm798975b3a.23.2026.08.06.00.31.15 for\n"
        " <AIAGENT+a1b2c3d4@carmensoftware.com> (version=TLS1_3\n"
        " cipher=TLS_AES_256_GCM_SHA384 bits=256/256); Thu, 06 Aug 2026 00:31:16 -0700\n"
        "To: AIAGENT+a1b2c3d4@carmensoftware.com\n"
    )
    assert msg.get_all("Delivered-To") is None
    assert tag_from_recipients(imap._recipients(msg)) == "a1b2c3d4"


def test_genuine_external_mail_to_the_bare_address_yields_no_tag():
    """The other measured shape: both signals present, neither carrying a tag."""
    msg = _msg(
        "Delivered-To: AIAGENT@carmensoftware.com\n"
        "Received: by 2002:a5d:6187:0:b0:47f with SMTP id j7csp2466891wru;\n"
        " Wed, 5 Aug 2026 23:05:51 -0700 (PDT)\n"
        "Received: from mail.facebook.com (mail.facebook.com. [66.220.155.149]) by\n"
        " mx.google.com with ESMTPS id x1si2 for <AIAGENT@carmensoftware.com>;\n"
        " Wed, 5 Aug 2026 23:05:50 -0700 (PDT)\n"
        "To: AIAGENT@carmensoftware.com\n"
    )
    assert tag_from_recipients(imap._recipients(msg)) is None


def test_the_to_header_is_never_a_tag_source():
    """`To:` is the customer's own address on an auto-forward, so reading it would pass a
    hand-sent test and route every real auto-forward nowhere.

    Pinned on behaviour rather than on the header list: a tagged `To:` with no delivery
    header and no `Received` chain must still resolve to nothing.
    """
    msg = _msg("From: staff@hotelgroup.com\nTo: AIAGENT+a1b2c3d4@carmensoftware.com\n")
    assert imap._recipients(msg) == []
    assert tag_from_recipients(imap._recipients(msg)) is None
    assert "To" not in imap._DELIVERY_HEADERS


def test_a_delivery_header_wins_over_a_received_clause():
    """A forward chain's own `Received` hops are older than the delivery we care about."""
    msg = _msg(
        "Delivered-To: AIAGENT+a1b2c3d4@carmensoftware.com\n"
        "Received: from relay.example (relay.example [10.0.0.1]) by mx.google.com with\n"
        " ESMTPS id q7si9 for <AIAGENT+ffffffff@carmensoftware.com>;\n"
        " Wed, 5 Aug 2026 23:05:50 -0700 (PDT)\n"
    )
    assert tag_from_recipients(imap._recipients(msg)) == "a1b2c3d4"


# ── resolve_by_tag ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_the_tag_resolves_to_its_owner():
    row = _row("bu-a")
    assert await es.resolve_by_tag(_db(one=row), "a1b2c3d4") is row


@pytest.mark.asyncio
async def test_an_unknown_tag_resolves_to_nobody():
    assert await es.resolve_by_tag(_db(one=None), "ffffffff") is None


@pytest.mark.asyncio
async def test_a_switched_off_bu_still_resolves_here():
    """Identity, not permission — see the docstring.

    A switched-off BU has to come back as itself so the caller can tell "known tag,
    paused" from "no such tag" and hand the mail back unread instead of dropping it.
    The gate itself lives in `_process_message` and is tested there.
    """
    row = _row("bu-a", enabled=False)
    db = _db(one=row)
    assert await es.resolve_by_tag(db, "a1b2c3d4") is row
    where = str(db.execute.await_args.args[0]).split("WHERE", 1)[1]
    assert "enabled" not in where  # the column is still selected, just not filtered on


# ── foreign_tax_id — verification, not routing ─────────────────────────────────


@pytest.mark.asyncio
async def test_a_tax_id_registered_to_another_bu_is_a_conflict():
    other = _row("bu-b", ["0994000165676"])
    clash = await es.foreign_tax_id(_db([other]), ["0994000165676"], "bu-a")
    assert clash == "0994000165676"


@pytest.mark.asyncio
async def test_the_bus_own_tax_id_is_not_a_conflict():
    mine = _row("bu-a", ["0105536000127"])
    assert await es.foreign_tax_id(_db([mine]), ["0105536000127"], "bu-a") is None


@pytest.mark.asyncio
async def test_an_unrecognised_tax_id_is_not_a_conflict():
    """Positive evidence only — a number nobody registered proves nothing."""
    other = _row("bu-b", ["0994000165676"])
    assert await es.foreign_tax_id(_db([other]), ["9999999999999"], "bu-a") is None


@pytest.mark.asyncio
async def test_a_document_printing_no_tax_id_still_passes():
    """Some fee invoices never print the buyer's TIN. Blocking those catches nothing."""
    other = _row("bu-b", ["0994000165676"])
    assert await es.foreign_tax_id(_db([other]), [], "bu-a") is None
    assert await es.foreign_tax_id(_db([other]), ["", "  "], "bu-a") is None


@pytest.mark.asyncio
async def test_a_disabled_bus_registered_number_still_counts_as_a_conflict():
    """It is still another company's number, whether or not they ingest today."""
    other = _row("bu-b", ["0994000165676"], enabled=False)
    db = _db([other])
    assert await es.foreign_tax_id(db, ["0994000165676"], "bu-a") == "0994000165676"
    assert "WHERE" not in str(db.execute.await_args.args[0])  # every row, not just enabled


# ── gmail_confirm_code — the one message we want that carries no document ──────

_CONFIRM_SUBJECT = "(#123456789) Gmail Forwarding Confirmation - Receive Mail from x@y.com"


def test_the_code_is_read_out_of_googles_subject():
    assert gmail_confirm_code("forwarding-noreply@google.com", _CONFIRM_SUBJECT) == "123456789"


def test_the_sender_is_matched_inside_a_display_name_form():
    """Real headers are `Gmail Team <forwarding-noreply@google.com>`, not bare addresses."""
    sender = "Gmail Team <Forwarding-Noreply@Google.com>"
    assert gmail_confirm_code(sender, _CONFIRM_SUBJECT) == "123456789"


def test_only_google_can_produce_a_code():
    """`(#123456789)` is an unremarkable thing for a bank to put in a subject line, and
    a false positive parks an invoice number on the settings screen as a 'code'."""
    assert gmail_confirm_code("no-reply@ktc.co.th", _CONFIRM_SUBJECT) is None


def test_googles_other_mail_yields_no_code():
    sender = "forwarding-noreply@google.com"
    assert gmail_confirm_code(sender, "Forwarding notice") is None


def test_missing_sender_or_subject_is_not_a_crash():
    assert gmail_confirm_code("", "") is None
    assert gmail_confirm_code(None, None) is None  # type: ignore[arg-type]


# ── sender_allowed — the optional owner-address layer ─────────────────────────

# From + To + Cc as the poll concatenates them, for each arrival mode.
_AUTO = 'From: "KTC" <no-reply@ktc.co.th> To: accounting@hotelgroup.com'
_MANUAL = "From: Somchai <somchai@hotelgroup.com> To: AIAGENT+a1b2c3d4@carmensoftware.com"


@pytest.mark.parametrize(
    "owners,people,allowed",
    [
        # Empty is the default and must never refuse anything, or switching the feature
        # on would silently stop every BU that has not filled this in.
        ([], _AUTO, True),
        ([], "", True),
        # Auto-forward: the customer is in To:, the bank is in From:.
        (["accounting@hotelgroup.com"], _AUTO, True),
        # Manual forward: the customer is in From: instead — one list has to cover both.
        (["somchai@hotelgroup.com"], _MANUAL, True),
        # Registering only the mailbox refuses the employee who forwards by hand. This is
        # the trap the settings hint warns about, pinned so it stays deliberate.
        (["accounting@hotelgroup.com"], _MANUAL, False),
        # Any one of several is enough.
        (["nobody@x.com", "accounting@hotelgroup.com"], _AUTO, True),
        (["accounting@other.com"], _AUTO, False),
        # Case-insensitive, and the display-name form needs no parsing.
        (["SOMCHAI@hotelgroup.com".lower()], _MANUAL.upper(), True),
    ],
)
def test_sender_allowed(owners, people, allowed):
    assert sender_allowed(owners, people) is allowed


def test_people_addresses_names_what_a_refused_mail_carried():
    """The header shapes of the 2026-08-28 incident, as `fetch_unseen` concatenates them.

    A BU had registered `acounting@hotelgroup.com` for a mailbox spelled
    `accounting@hotelgroup.com`, and every document it forwarded was skipped with a
    message that named no address at all. This is what makes the near-miss readable — and
    it fails if the comma join in `fetch_unseen` is ever reverted, because `getaddresses`
    parses an address list, not headers run together on whitespace.
    """
    people = ", ".join(
        [
            # A Thai display name is the common case here and must survive decoding.
            "สมชาย ใจดี <no-reply@ktc.co.th>",
            # Gmail's own form when the display name *is* the address — the quoted @ is
            # the reason this is parsed rather than regexed out.
            '"Accounting@hotelgroup.com" <accounting@hotelgroup.com>',
        ]
    )
    assert imap.people_addresses(people) == ["no-reply@ktc.co.th", "accounting@hotelgroup.com"]
    # A mail with no readable address must not raise — the caller falls back to a phrase.
    assert imap.people_addresses("") == []


# ── match_rules — a bank hint that is now also a hard gate ─────────────────────

RULES = [
    {
        "bank_code": "KTC",
        "bank_sender_email": "no-reply@ktc.co.th",
        "filename_patterns": ["MDR", "Commission"],
        "is_active": True,
    },
    {
        "bank_code": "GHL",
        "bank_sender_email": None,
        "filename_patterns": ["GHL-FEE"],
        "is_active": True,
    },
    {
        "bank_code": "BBL",
        "bank_sender_email": "old@bbl.co.th",
        "filename_patterns": ["statement"],
        "is_active": False,
    },
]


def _codes(sender, filename, rules=RULES):
    return [r["bank_code"] for r in match_rules(rules, sender, filename)]


def test_a_sender_hit_does_not_bypass_a_filename_miss():
    """The bug the old early-return would have reintroduced.

    Mail from KTC's address carrying a file only the GHL rule names must stop, not be
    scanned as KTC.
    """
    assert _codes("no-reply@ktc.co.th", "GHL-FEE-report.pdf") == []


def test_a_sender_hit_with_its_own_filename_matches():
    assert _codes("no-reply@ktc.co.th", "MDR-2026-08.pdf") == ["KTC"]


def test_a_sender_matching_no_rule_leaves_every_rule_eligible():
    """A manual forward comes from an employee, so narrowing must never empty the set."""
    assert _codes("employee@hotelgroup.com", "monthly-GHL-FEE.pdf") == ["GHL"]


def test_any_one_pattern_in_the_list_is_enough():
    assert _codes("no-reply@ktc.co.th", "Commission_aug.pdf") == ["KTC"]


@pytest.mark.parametrize(
    "filename",
    ["MDR-report.pdf", "aug-MDR-2026.pdf", "report-MDR.pdf", "monthly_mdr_report.PDF"],
)
def test_a_pattern_matches_anywhere_and_case_insensitively(filename):
    """Pins `%pattern%`, so a later refactor cannot quietly tighten it to equality —
    banks vary their filenames and employees rename files before forwarding."""
    assert _codes("employee@hotelgroup.com", filename) == ["KTC"]


def test_an_attachment_no_rule_claims_matches_nothing():
    """Empty means stop, with no LLM call — the signature-logo class of junk."""
    assert _codes("employee@hotelgroup.com", "logo.png") == []


def test_an_inactive_rule_is_never_matched():
    assert _codes("old@bbl.co.th", "statement.pdf") == []


def test_overlapping_patterns_return_every_match_so_no_bank_is_guessed():
    rules = [
        {"bank_code": "KTC", "filename_patterns": ["report"], "is_active": True},
        {"bank_code": "GHL", "filename_patterns": ["report"], "is_active": True},
    ]
    assert _codes("employee@hotelgroup.com", "report.pdf", rules) == ["KTC", "GHL"]


def test_no_rules_at_all_matches_nothing():
    assert match_rules([], "anyone@bank.com", "file.pdf") == []


def test_a_rule_with_no_patterns_matches_nothing():
    """save_settings rejects this, but a legacy row must fail closed, not open."""
    assert match_rules([{"bank_code": "KTC", "is_active": True}], "x@y.com", "a.pdf") == []
