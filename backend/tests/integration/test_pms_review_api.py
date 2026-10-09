"""CA-119 — /api/v1/pms/days/* and /settings: the review modal's and #/pms's routes."""

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
DAY = {
    "id": str(uuid4()),
    "interface": "Comanche",
    "doc_type": "Daily",
    "doc_date": "2024-09-05",
    "terms": [{"type": "Revenue", "amount": "1127.00"}],
    "off": "0.00",
    "codes": 4,
    "accounts": {"Payment|900": {"dept": "101", "acc": "1010001"}},
    "new_codes": [
        {
            "key": "Revenue|729",
            "code": "729",
            "description": "Rebate",
            "type": "Revenue",
            "amount": "-50.00",
        }
    ],
    "rows": [{"type": "Revenue", "code": "729", "desc": "Rebate", "amount": "-50.00"}],
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
    assert res.json()["new_codes"][0]["code"] == "729"
    assert get.await_args.args[1] == TENANT


def test_a_day_not_waiting_is_404():
    with patch("app.routers.pms.pms_review.get_day", AsyncMock(return_value=None)), _client() as c:
        res = c.get(f"/api/v1/pms/days/{uuid4()}")
    assert res.status_code == 404


def test_approve_passes_the_picks_and_the_reviewer():
    approve = AsyncMock(return_value={"jv_no": "JV2409-0066"})
    with patch("app.routers.pms.pms_review.approve", approve), _client() as c:
        res = c.post(
            f"/api/v1/pms/days/{DAY['id']}/approve",
            json={"mappings": {"Revenue|729": {"dept": "304", "acc": "4240011"}}},
        )
    assert res.status_code == 200
    assert res.json() == {"jv_no": "JV2409-0066"}
    tenant, _day, picks = approve.await_args.args
    assert tenant == TENANT
    assert picks == {"Revenue|729": {"dept": "304", "acc": "4240011"}}
    assert approve.await_args.kwargs["reviewer"] == SESSION.carmen_user_id


def test_approve_refusal_is_a_400_with_the_reason():
    from app.exceptions import ValidationError

    approve = AsyncMock(side_effect=ValidationError("Pick an account for every new code"))
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


def test_settings_get_and_put():
    out = {"jv_prefix": "JV", "auto_post": False, "has_credential": True}
    db = MagicMock(commit=AsyncMock())
    with (
        patch("app.routers.pms.pms_review.get_settings", AsyncMock(return_value=out)),
        patch("app.routers.pms.pms_review.save_settings", AsyncMock(return_value=out)) as save,
        _client(db) as c,
    ):
        assert c.get("/api/v1/pms/settings").json() == out
        res = c.put("/api/v1/pms/settings", json={"jv_prefix": "JV", "auto_post": False})
    assert res.status_code == 200
    assert save.await_args.kwargs == {"jv_prefix": "JV", "auto_post": False}
    db.commit.assert_awaited_once()


def test_credential_is_proven_stored_and_wakes_the_days_waiting_for_it():
    from types import SimpleNamespace

    tenant = SimpleNamespace(id=TENANT, host="dev.carmen4.com", bu_code="test1")
    waiting = [uuid4(), uuid4()]
    db = MagicMock(
        get=AsyncMock(return_value=tenant),
        execute=AsyncMock(
            return_value=MagicMock(
                scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=waiting)))
            )
        ),
        commit=AsyncMock(),
    )
    out = {"jv_prefix": None, "auto_post": False, "has_credential": True}
    with (
        patch(
            "app.routers.pms._safe_carmen_uri", AsyncMock(return_value="https://dev.carmen4.com")
        ),
        patch("app.routers.pms.credential.set_token", AsyncMock()) as set_token,
        patch("app.routers.pms.pms_review.get_settings", AsyncMock(return_value=out)),
        patch("app.routers.pms.process.kick") as kick,
        _client(db) as c,
    ):
        res = c.put("/api/v1/pms/credential", json={"token": "hash|user"})
    assert res.status_code == 200
    assert res.json()["has_credential"] is True
    args = set_token.await_args.args
    assert args[1] is tenant and args[2] == "hash|user" and args[3] == "https://dev.carmen4.com"
    assert [c.args[0] for c in kick.call_args_list] == waiting


def test_a_token_carmen_refuses_is_not_stored():
    from types import SimpleNamespace

    from app.exceptions import FieldValidationError

    tenant = SimpleNamespace(id=TENANT, host="dev.carmen4.com", bu_code="test1")
    db = MagicMock(get=AsyncMock(return_value=tenant), commit=AsyncMock())
    refuse = AsyncMock(
        side_effect=FieldValidationError(
            [{"field": "token", "code": "token_rejected", "message": "Carmen rejected this token"}]
        )
    )
    with (
        patch(
            "app.routers.pms._safe_carmen_uri", AsyncMock(return_value="https://dev.carmen4.com")
        ),
        patch("app.routers.pms.credential.set_token", refuse),
        patch("app.routers.pms.process.kick") as kick,
        _client(db) as c,
    ):
        res = c.put("/api/v1/pms/credential", json={"token": "dead"})
    assert res.status_code == 422
    kick.assert_not_called()
