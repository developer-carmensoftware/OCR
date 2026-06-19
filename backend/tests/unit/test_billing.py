"""
Unit tests for the billing sub-system:
  - tax.split_inclusive
  - promptpay_service.build_payload (CRC + payload structure)
  - billing_document_service._next_document_number (sequence formatting)
"""

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services import promptpay_service
from app.utils.tax import split_inclusive

# ── tax.split_inclusive ───────────────────────────────────────────────────────


def test_split_inclusive_standard():
    sub, vat = split_inclusive(Decimal("990"))
    assert sub == Decimal("925.23")
    assert vat == Decimal("64.77")
    assert sub + vat == Decimal("990")


def test_split_inclusive_round_trip():
    for gross in ("100", "2990", "5990", "1.00", "0.07"):
        g = Decimal(gross)
        sub, vat = split_inclusive(g)
        assert sub + vat == g, f"round-trip failed for {gross}"


def test_split_inclusive_zero():
    sub, vat = split_inclusive(Decimal("0"))
    assert sub == Decimal("0.00")
    assert vat == Decimal("0.00")


def test_split_inclusive_custom_rate():
    sub, vat = split_inclusive(Decimal("107"), rate=Decimal("0.07"))
    assert sub == Decimal("100.00")
    assert vat == Decimal("7.00")


# ── promptpay_service.build_payload ──────────────────────────────────────────


def test_payload_starts_with_version():
    payload = promptpay_service.build_payload("0812345678", 100.0)
    assert payload.startswith("000201")


def test_payload_ends_with_4char_crc():
    payload = promptpay_service.build_payload("0812345678", 100.0)
    assert payload[-8:-4] == "6304"
    assert len(payload[-4:]) == 4


def test_payload_contains_thb_currency():
    payload = promptpay_service.build_payload("0812345678", 99.0)
    assert "5303764" in payload  # tag53 + len02 + '764'


def test_payload_contains_amount():
    payload = promptpay_service.build_payload("0812345678", 990.0)
    assert "990.00" in payload


def test_payload_mobile_proxy_tag():
    # mobile number → proxy tag '01', normalized to 0066XXXXXXXXX (13 digits)
    payload = promptpay_service.build_payload("0812345678", 1.0)
    # TLV: tag='01' + len='13' + value='0066812345678'
    assert "01130066812345678" in payload


def test_payload_national_id_proxy_tag():
    # 13-digit tax/national ID → proxy tag '02'
    payload = promptpay_service.build_payload("1234567890123", 1.0)
    # TLV: tag='02' + len='13' + value='1234567890123'
    assert "02131234567890123" in payload


def test_crc_is_deterministic():
    p1 = promptpay_service.build_payload("0815659547", 990.0)
    p2 = promptpay_service.build_payload("0815659547", 990.0)
    assert p1 == p2


# ── billing_document_service._next_document_number ───────────────────────────


@pytest.mark.asyncio
async def test_next_document_number_format():
    # Single shared sequence across all doc types: AI-YYYYMMDD-NNNN.
    from app.services.billing_document_service import _next_document_number

    db = AsyncMock()
    result_mock = MagicMock()
    result_mock.scalar_one.return_value = 1
    db.execute = AsyncMock(return_value=result_mock)

    number = await _next_document_number(db)
    assert number.startswith("AI-")
    assert len(number) == len("AI-20260619-0001")
    assert number.endswith("-0001")


@pytest.mark.asyncio
async def test_next_document_number_higher_counter():
    from app.services.billing_document_service import _next_document_number

    db = AsyncMock()
    result_mock = MagicMock()
    result_mock.scalar_one.return_value = 42
    db.execute = AsyncMock(return_value=result_mock)

    number = await _next_document_number(db)
    assert number.startswith("AI-")
    assert number.endswith("-0042")


def test_payload_amount_integer_formatted_as_two_decimals():
    # integer input like 100 (not 100.0) must still produce "100.00" in payload
    payload = promptpay_service.build_payload("0812345678", 100)
    assert "100.00" in payload


def test_payload_national_id_does_not_contain_mobile_prefix():
    # 13-digit national/tax ID must NOT be normalised with the 0066 mobile prefix
    payload = promptpay_service.build_payload("1234567890123", 1.0)
    # The merchant account section must not contain the mobile normalisation marker
    # (tag 01 is for mobile; tag 02 for national ID — ensure 0066 is absent)
    assert "0066" not in payload


@pytest.mark.asyncio
async def test_next_document_number_zero_padded():
    from app.services.billing_document_service import _next_document_number

    db = AsyncMock()
    result_mock = MagicMock()
    result_mock.scalar_one.return_value = 999
    db.execute = AsyncMock(return_value=result_mock)

    number = await _next_document_number(db)
    assert number.endswith("-0999")
