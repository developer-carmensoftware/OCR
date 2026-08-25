"""Unit tests for ar_posting_service.post_ar_entry — payload mapping + Carmen Code handling."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import ar_posting_service


def _kwargs():
    return dict(
        deal_id="PF-202606-0007",
        ar_code="AR-ACME01",
        account_name="Acme Co.,Ltd.",
        closing_date="2026-06-15T00:00:00+00:00",
        total=1059.30,
        net=990.00,
        vat=69.30,
        description="Package : starter — 1059.30 THB",
        remark="Contact Name : Somchai",
    )


@patch.object(ar_posting_service.settings, "carmen_ar_url", "")
async def test_unconfigured_raises():
    with pytest.raises(RuntimeError, match="not configured"):
        await ar_posting_service.post_ar_entry(**_kwargs())


def _mock_resp(json_body):
    resp = MagicMock()
    resp.json.return_value = json_body
    resp.status_code = 200
    return resp


@patch.object(ar_posting_service.settings, "carmen_ar_url", "https://erp.test/CarmenAI")
@patch.object(ar_posting_service.settings, "carmen_ar_token", "tok")
async def test_code_zero_succeeds_and_maps_payload():
    client = MagicMock()
    client.post = AsyncMock(return_value=_mock_resp({"Code": 0, "MoreInfo": "AR000123"}))
    with patch.object(ar_posting_service, "get_http_client", return_value=client):
        out = await ar_posting_service.post_ar_entry(**_kwargs())

    assert out == {"success": True, "carmen_ar_ref": "AR000123"}
    payload = client.post.call_args.kwargs["json"]
    assert payload["DealId"] == "PF-202606-0007"  # Proforma Invoice No, not the order UUID
    assert payload["ArNo"] == "AR-ACME01"
    assert payload["TotalAmount"] == 1059.30
    assert payload["Amount"] == 990.00
    assert payload["TaxAmount"] == 69.30
    assert payload["ServiceAmount"] == 0
    assert payload["ClosingDate"] == "2026-06-15T00:00:00+00:00"  # Proforma Date, not now()
    assert payload["Remark"] == "Contact Name : Somchai"


@patch.object(ar_posting_service.settings, "carmen_ar_url", "https://erp.test/CarmenAI")
@patch.object(ar_posting_service.settings, "carmen_ar_token", "tok")
async def test_nonzero_code_raises_with_user_message():
    client = MagicMock()
    client.post = AsyncMock(return_value=_mock_resp({"Code": 1, "UserMessage": "Invalid AR code"}))
    with patch.object(ar_posting_service, "get_http_client", return_value=client):
        with pytest.raises(RuntimeError, match="Invalid AR code"):
            await ar_posting_service.post_ar_entry(**_kwargs())


@patch.object(ar_posting_service.settings, "carmen_ar_url", "https://erp.test/CarmenAI")
@patch.object(ar_posting_service.settings, "carmen_ar_token", "tok")
async def test_ref_falls_back_to_ar_code_when_no_more_info():
    client = MagicMock()
    client.post = AsyncMock(return_value=_mock_resp({"Code": 0}))
    with patch.object(ar_posting_service, "get_http_client", return_value=client):
        out = await ar_posting_service.post_ar_entry(**_kwargs())
    assert out["carmen_ar_ref"] == "AR-ACME01"
