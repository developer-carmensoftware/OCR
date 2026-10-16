"""CA-119 — /api/v1/pms/days/*: the review modal's routes."""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.auth.session import SessionInfo
from tests.integration.conftest import make_test_client

TENANT = uuid4()
SESSION = SessionInfo(
    session_id="sess-pms",
    carmen_token="tok",
    carmen_user_id="u-test",
    username="tester",
    tenant_id=str(TENANT),
    carmen_uri="https://test.carmenwork.com",
    bu="BU01",
)
KEY = '["729","Rebate - Misc. (VAT)"]'
DAY = {
    "id": str(uuid4()),
    "interface": "Comanche",
    "doc_type": "Daily",
    "doc_date": "2024-09-05",
    "setting_code": "Comanche.PMS",
    "post_type": "REVENUE",
    "counter": {"dept": "GEN", "acc": "1021001", "name": "A/R - Guest Ledger"},
    "key_columns": ["Code", "Description"],
    "rows": [
        {
            "key": KEY,
            "values": {"Code": "729", "Description": "Rebate - Misc. (VAT)"},
            "amount": "-50.00",
        }
    ],
    "mapped_count": 0,
    "new_codes": [
        {
            "key": KEY,
            "label": "729 · Rebate - Misc. (VAT)",
            "values": {"Code": "729", "Description": "Rebate - Misc. (VAT)"},
            "amount": "-50.00",
        }
    ],
}


def _client(db=None):
    return make_test_client(db or MagicMock(commit=AsyncMock()), session=SESSION)


def test_get_day():
    with (
        patch("app.routers.pms.pms_review.get_day", AsyncMock(return_value=DAY)) as get,
        _client() as c,
    ):
        res = c.get(f"/api/v1/pms/days/{DAY['id']}")
    assert res.status_code == 200
    assert res.json()["new_codes"][0]["label"] == "729 · Rebate - Misc. (VAT)"
    assert get.await_args.args[1] == TENANT


def test_a_day_not_waiting_is_404():
    with patch("app.routers.pms.pms_review.get_day", AsyncMock(return_value=None)), _client() as c:
        res = c.get(f"/api/v1/pms/days/{uuid4()}")
    assert res.status_code == 404


def test_approve_passes_the_picks_and_the_reviewer():
    approve = AsyncMock(return_value={"jv_no": None, "already_posted": False})
    with patch("app.routers.pms.pms_review.approve", approve), _client() as c:
        res = c.post(
            f"/api/v1/pms/days/{DAY['id']}/approve",
            json={"mappings": {KEY: {"dept": "304", "acc": "4240011"}}},
        )
    assert res.status_code == 200
    assert res.json() == {"jv_no": None, "already_posted": False}
    tenant, _day, picks = approve.await_args.args
    assert tenant == TENANT
    assert picks == {KEY: {"dept": "304", "acc": "4240011"}}
    assert approve.await_args.kwargs["reviewer"] == SESSION.carmen_user_id


def test_approve_refusal_is_a_400_with_the_reason():
    from app.exceptions import ValidationError

    approve = AsyncMock(side_effect=ValidationError("Pick an account for every new row"))
    with patch("app.routers.pms.pms_review.approve", approve), _client() as c:
        res = c.post(f"/api/v1/pms/days/{DAY['id']}/approve", json={"mappings": {}})
    assert res.status_code == 400
    assert "Pick an account" in res.json()["detail"]


def test_reject():
    reject = AsyncMock()
    with patch("app.routers.pms.pms_review.reject", reject), _client() as c:
        res = c.post(f"/api/v1/pms/days/{DAY['id']}/reject", json={"reason": "night audit rerun"})
    assert res.status_code == 204
    assert reject.await_args.args[2] == "night audit rerun"
