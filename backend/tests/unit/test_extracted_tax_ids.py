"""
Unit tests for ExtractedCreditCardData.tax_ids — the field email automation's
tax-ID gate (§2.4) relies on. The LLM's JSON output is untrusted, so the
field_validator must coerce it defensively rather than raising or passing
through junk. No live LLM call needed — these are the same shapes
parse_vision_json would hand to the model constructor.
"""

from app.models.schemas import ExtractedCreditCardData


def _tax_ids(raw) -> list[str]:
    return ExtractedCreditCardData(tax_ids=raw).tax_ids


def test_well_formed_array_passes_through():
    assert _tax_ids(["0105536000123", "1234567890123"]) == ["0105536000123", "1234567890123"]


def test_dashes_and_spaces_are_stripped():
    assert _tax_ids(["010-5536-000123"]) == ["0105536000123"]


def test_wrong_length_entries_are_dropped():
    assert _tax_ids(["12345", "0105536000123", "12345678901234567"]) == ["0105536000123"]


def test_duplicates_are_removed():
    assert _tax_ids(["0105536000123", "0105536000123"]) == ["0105536000123"]


def test_none_becomes_empty_list():
    assert _tax_ids(None) == []


def test_bare_string_is_wrapped_before_validation():
    assert _tax_ids("0105536000123") == ["0105536000123"]


def test_non_list_junk_becomes_empty_list():
    assert _tax_ids(42) == []


def test_missing_field_defaults_to_empty_list():
    assert ExtractedCreditCardData().tax_ids == []
