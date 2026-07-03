"""
Unit tests for utils/date_parsing.py
"""

from datetime import date, datetime

from app.utils.date_parsing import format_doc_date, parse_doc_date


def test_parses_dd_mm_yyyy():
    assert parse_doc_date("15/03/2024") == date(2024, 3, 15)


def test_parses_iso():
    assert parse_doc_date("2024-03-15") == date(2024, 3, 15)


def test_parses_dashes():
    assert parse_doc_date("15-03-2024") == date(2024, 3, 15)


def test_parses_dots():
    assert parse_doc_date("15.03.2024") == date(2024, 3, 15)


def test_buddhist_year_converted_to_gregorian():
    # 2567 BE = 2024 AD
    assert parse_doc_date("15/03/2567") == date(2024, 3, 15)


def test_thai_month_name_buddhist_year():
    # KTC/GHL print dates like "01 พฤษภาคม 2569" (May 1, 2026)
    assert parse_doc_date("01 พฤษภาคม 2569") == date(2026, 5, 1)


def test_thai_month_abbreviation():
    assert parse_doc_date("31 พ.ค. 2569") == date(2026, 5, 31)


def test_thai_month_gregorian_year():
    assert parse_doc_date("15 มกราคม 2024") == date(2024, 1, 15)


def test_thai_month_no_space_after_abbreviation_dot():
    # Common Thai typography: no space between abbreviation and year
    assert parse_doc_date("31 พ.ค.2569") == date(2026, 5, 31)


def test_thai_month_with_date_label_prefix():
    assert parse_doc_date("วันที่ 01 พฤษภาคม 2569") == date(2026, 5, 1)


def test_thai_month_two_digit_buddhist_year():
    # '67' = BE 2567 = 2024 AD — must not become year 0067
    assert parse_doc_date("31 ม.ค. 67") == date(2024, 1, 31)


def test_parses_two_digit_numeric_year():
    # SiamPay prints "27/05/26" (DD/MM/YY, AD 2-digit) — must not return None
    assert parse_doc_date("27/05/26") == date(2026, 5, 27)
    assert parse_doc_date("20/05/26") == date(2026, 5, 20)


def test_four_digit_year_wins_over_two_digit():
    # A full year must still parse as-is (2-digit formats are only a fallback)
    assert parse_doc_date("05/05/2026") == date(2026, 5, 5)


def test_returns_none_on_garbage():
    assert parse_doc_date("not a date") is None


def test_returns_none_on_empty():
    assert parse_doc_date("") is None
    assert parse_doc_date(None) is None


def test_returns_none_on_invalid_calendar_date():
    # Feb 30 doesn't exist
    assert parse_doc_date("30/02/2024") is None


def test_passes_through_date_objects():
    d = date(2024, 5, 1)
    assert parse_doc_date(d) == d


def test_extracts_date_from_datetime():
    dt = datetime(2024, 5, 1, 12, 30)
    assert parse_doc_date(dt) == date(2024, 5, 1)


def test_format_to_dd_mm_yyyy():
    assert format_doc_date(date(2024, 3, 15)) == "15/03/2024"


def test_format_none_returns_none():
    assert format_doc_date(None) is None


def test_format_passes_through_strings():
    # Backward compat: existing string data flows through unchanged
    assert format_doc_date("15/03/2024") == "15/03/2024"
