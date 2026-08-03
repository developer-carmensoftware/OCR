"""
Unit tests for the pure routing helpers in services/email_ingest_service.py:
`extract_tag` (which recipient header identifies the BU) and `match_rule`
(which configured rule an attachment belongs to). No DB, no IMAP, no mocks.
"""

from app.services.email_ingest_service import extract_tag, match_rule

MAILBOX = "ocr@carmensoftware.com"


# ── extract_tag ────────────────────────────────────────────────────────────────


def test_extract_tag_from_to_header():
    assert extract_tag(["ocr+7f3a91@carmensoftware.com"], MAILBOX) == "7f3a91"


def test_extract_tag_from_delivered_to_when_to_was_rewritten_by_forward():
    # An auto-forward rule often rewrites To: to the forwarding rule's own address —
    # Delivered-To / X-Original-To are what actually saw the +tag.
    recipients = ["someone@hotelgroup.com", "ocr+abc123@carmensoftware.com"]
    assert extract_tag(recipients, MAILBOX) == "abc123"


def test_extract_tag_is_case_insensitive_and_lowercases_result():
    assert extract_tag(["OCR+ABC123@CARMENSOFTWARE.COM"], MAILBOX) == "abc123"


def test_extract_tag_missing_returns_none():
    assert extract_tag(["someone@hotelgroup.com"], MAILBOX) is None


def test_extract_tag_empty_recipients_returns_none():
    assert extract_tag([], MAILBOX) is None


def test_extract_tag_ignores_a_lookalike_address_on_a_different_domain():
    assert extract_tag(["ocr+abc123@not-carmensoftware.com"], MAILBOX) is None


# ── match_rule ─────────────────────────────────────────────────────────────────

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
