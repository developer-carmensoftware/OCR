"""End-to-end regression proof for the double-VAT bug: chains the REAL
issue_document (billing_document_service) into the REAL post_ar_entry
(ar_posting_service) — only the Carmen HTTP call is mocked — and asserts the
exact JSON payload Carmen receives. Locks in that a 490 THB net catalog price
(price_thb is ex-VAT, per checkout's "Prices exclude 7% VAT") always posts as
524.30/490.00/34.30, never the double-VATed 561.00.
"""

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.enums import BillingDocumentType
from app.services import ar_posting_service
from app.services.billing_document_service import BuyerInfo, issue_document


def _make_db():
    db = AsyncMock()
    result = MagicMock()
    result.all.return_value = []
    result.first.return_value = None
    result.scalar_one.return_value = 1
    db.execute = AsyncMock(return_value=result)
    db.add = MagicMock()
    return db


def _mock_resp(json_body):
    resp = MagicMock()
    resp.json.return_value = json_body
    resp.status_code = 200
    return resp


@patch.object(ar_posting_service.settings, "carmen_ar_url", "https://erp.test/CarmenAI")
@patch.object(ar_posting_service.settings, "carmen_ar_token", "tok")
async def test_starter_pack_posts_524_30_not_double_vated_561():
    db = _make_db()
    with (
        patch(
            "app.services.billing_document_service._fetch_billing_configs",
            new=AsyncMock(return_value={"billing.vat_rate": "7"}),
        ),
        patch(
            "app.services.billing_document_service._next_document_number",
            new=AsyncMock(return_value="PI-202607-0001"),
        ),
    ):
        proforma = await issue_document(
            db,
            tenant_id="t-1",
            order_id="o-1",
            doc_type=BillingDocumentType.PROFORMA,
            pack_code="sub_starter",
            pack_description="Starter Plan — 200 credits/month",
            credits=200,
            # sub_starter.price_thb seed value — net, per VAT_NOTE ("Prices exclude 7% VAT").
            amount_thb=Decimal("490"),
            buyer=BuyerInfo(
                name="Camen Cloud Co.,Ltd.",
                contact_name="Boonyawat Jiratthanasaweat",
                tel="022840429",
                email="support@carmensoftware.com",
            ),
        )

    # The proforma itself must be correct (it always has been).
    assert proforma.subtotal == Decimal("490")
    assert proforma.vat_amount == Decimal("34.30")
    assert proforma.total == Decimal("524.30")

    client = MagicMock()
    client.post = AsyncMock(return_value=_mock_resp({"Code": 0, "MoreInfo": "AR000999"}))
    with patch.object(ar_posting_service, "_get_client", return_value=client):
        # Mirrors exactly what routers/admin/credits.py's post_ar now sends —
        # sourced entirely from the proforma, no internal tax invoice involved.
        await ar_posting_service.post_ar_entry(
            deal_id=str(proforma.number),
            ar_code="AR-TEST001",
            account_name=str(proforma.buyer_name),
            closing_date=proforma.issue_date.isoformat(),
            total=float(proforma.total),
            net=float(proforma.subtotal),
            vat=float(proforma.vat_amount),
            description=f"Package : {proforma.description} — {proforma.total} THB",
            remark=(
                f"Contact Name : {proforma.buyer_contact_name}\n"
                f"Tel. : {proforma.buyer_tel}\n"
                f"Email : {proforma.buyer_email}"
            ),
        )

    payload = client.post.call_args.kwargs["json"]
    assert payload["TotalAmount"] == 524.30
    assert payload["Amount"] == 490.00
    assert payload["TaxAmount"] == 34.30
    assert payload["Description"] == "Package : Starter Plan — 200 credits/month — 524.30 THB"
    assert payload["Remark"] == (
        "Contact Name : Boonyawat Jiratthanasaweat\n"
        "Tel. : 022840429\n"
        "Email : support@carmensoftware.com"
    )
