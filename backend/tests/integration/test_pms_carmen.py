"""Decision-log #44 — /api/v1/carmen/pms: Carmen's PMS setting screen sets auto-post and
generates the hook key, per BU and PMS.

What is pinned: `pms` arrives lower-cased and reaches every write; a Carmen write stores the
proven token as the BU's credential and wakes the days waiting for one, an operator's does
not; a new key comes back once; revoking without a key is a 404; the #/pms routes are gone.
`_caller` and `_resolve` (proof, and creating a BU it has never seen) are pinned in
test_email_automation_router.py.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.auth.admin_session import AdminPrincipal
from app.routers.email_automation.settings_api import Caller, _caller
from tests.integration.conftest import make_test_client

BASE = "/api/v1/carmen/pms"
CARMEN_TOKEN = "direct 9f3ac1|3fa85f64-5717-4562-b3fc-2c963f66afa6"
CARMEN = Caller("user:3fa85f64-5717-4562-b3fc-2c963f66afa6", CARMEN_TOKEN)
ADMIN = Caller(
    "admin:alice",
    None,
    AdminPrincipal(
        admin_id="a-1", username="alice", roles=["admin"], perms={"configs:write"}, tenant_scope=""
    ),
)
TENANT = SimpleNamespace(id=uuid4(), host="hotel.carmen4.com", bu_code="gh01")
REF = {"uri": "https://hotel.carmen4.com", "bu": "gh01", "pms": "Comanche"}
OUT = {"pms": "comanche", "auto_post": True, "key": None, "has_credential": True}


def _call(method, path, caller=CARMEN, waiting=(), read_tenant=TENANT, **kw):
    """One request with `_caller` overridden and everything past `_resolve` observable."""
    from app.main import app

    app.dependency_overrides[_caller] = lambda: caller
    db = MagicMock(commit=AsyncMock())
    m = {
        "resolve": patch("app.routers.pms_carmen._resolve", AsyncMock(return_value=TENANT)),
        "read": patch(
            "app.routers.pms_carmen._resolve_for_read", AsyncMock(return_value=read_tenant)
        ),
        "origin": patch(
            "app.routers.pms_carmen._safe_carmen_uri",
            AsyncMock(return_value="https://hotel.carmen4.com"),
        ),
        "adopt_token": patch("app.routers.pms_carmen.credential.adopt_token", AsyncMock()),
        "wake": patch(
            "app.routers.pms_carmen.process.wake_waiting", AsyncMock(return_value=list(waiting))
        ),
        "kick": patch("app.routers.pms_carmen.process.kick"),
        "get": patch("app.routers.pms_carmen.pms_review.get_settings", AsyncMock(return_value=OUT)),
        "save": patch("app.routers.pms_carmen.pms_review.save_settings", AsyncMock()),
        "audit": patch("app.routers.pms_carmen.log_action", AsyncMock()),
        "admin_audit": patch("app.routers.pms_carmen.log_admin_action", AsyncMock()),
    }
    started = {name: p.start() for name, p in m.items()}
    try:
        with make_test_client(db) as client:
            res = client.request(method, f"{BASE}{path}", **kw)
    finally:
        for p in m.values():
            p.stop()
    return res, started


# ── settings ───────────────────────────────────────────────────────────────────────


def test_get_reads_this_pms_and_writes_nothing():
    res, m = _call("GET", "/settings", params=REF)
    assert res.status_code == 200 and res.json() == OUT
    m["resolve"].assert_not_awaited()  # the read path, which never creates a BU
    assert m["get"].await_args.args[1:] == (TENANT.id, "comanche")
    m["adopt_token"].assert_not_awaited()  # a read stores nothing


def test_get_for_a_bu_never_seen_answers_the_defaults():
    res, m = _call("GET", "/settings", read_tenant=None, params=REF)
    assert res.status_code == 200
    assert res.json() == {
        "pms": "comanche",
        "auto_post": False,
        "key": None,
        "has_credential": False,
    }
    m["get"].assert_not_awaited()


@pytest.mark.parametrize(("method", "body"), [("PUT", {**REF, "auto_post": True}), ("POST", REF)])
def test_the_writes_register_a_bu_never_seen(method, body):
    with patch(
        "app.routers.pms_carmen.api_keys.issue",
        AsyncMock(return_value=(SimpleNamespace(id=uuid4()), "cpk_x")),
    ):
        res, m = _call(method, "/settings" if method == "PUT" else "/keys", json=body)
    assert res.status_code in (200, 201)
    assert m["resolve"].await_args.kwargs == {"create": True}


def test_put_stores_the_credential_wakes_the_waiting_days_and_saves_this_pms():
    waiting = [uuid4(), uuid4()]
    res, m = _call("PUT", "/settings", waiting=waiting, json={**REF, "auto_post": True})
    assert res.status_code == 200 and res.json() == OUT
    assert m["adopt_token"].await_args.args[1:4] == (
        TENANT,
        CARMEN_TOKEN,
        "https://hotel.carmen4.com",
    )
    assert [c.args[0] for c in m["kick"].call_args_list] == waiting
    assert m["save"].await_args.args[1:] == (TENANT.id, "comanche")
    assert m["save"].await_args.kwargs["auto_post"] is True


def test_an_operator_write_stores_no_credential():
    res, m = _call("PUT", "/settings", caller=ADMIN, json={**REF, "auto_post": False})
    assert res.status_code == 200
    m["adopt_token"].assert_not_awaited()
    m["save"].assert_awaited_once()


@pytest.mark.parametrize("pms", ["Coman/che", "", "x" * 41], ids=["slash", "empty", "long"])
def test_a_pms_the_hook_could_not_send_is_a_422(pms):
    res, m = _call("GET", "/settings", params={**REF, "pms": pms})
    assert res.status_code == 422
    m["resolve"].assert_not_awaited()


# ── keys ───────────────────────────────────────────────────────────────────────────


def test_generate_returns_the_key_once_and_stores_the_credential():
    key = SimpleNamespace(id=uuid4())
    with patch(
        "app.routers.pms_carmen.api_keys.issue", AsyncMock(return_value=(key, "cpk_secret"))
    ) as issue:
        res, m = _call("POST", "/keys", json=REF)
    assert res.status_code == 201
    assert res.json() == {**OUT, "api_key": "cpk_secret"}
    assert issue.await_args.args[1:] == (TENANT.id, "comanche hook", "comanche")
    m["adopt_token"].assert_awaited_once()
    m["audit"].assert_awaited_once()


def test_revoke_without_a_live_key_is_404():
    with patch("app.routers.pms_carmen.api_keys.live_key", AsyncMock(return_value=None)):
        res, _ = _call("DELETE", "/keys", params=REF)
    assert res.status_code == 404


def test_revoke_switches_this_pms_off():
    key = SimpleNamespace(id=uuid4())
    with (
        patch("app.routers.pms_carmen.api_keys.live_key", AsyncMock(return_value=key)),
        patch("app.routers.pms_carmen.api_keys.revoke_live", AsyncMock()) as revoke,
    ):
        res, m = _call("DELETE", "/keys", params=REF)
    assert res.status_code == 204
    assert revoke.await_args.args[1:] == (TENANT.id, "comanche")
    assert m["resolve"].await_args.kwargs == {}  # revoking never registers a BU


# ── #/pms is gone ──────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("method", "path"),
    [("GET", "/keys"), ("POST", "/keys"), ("GET", "/settings"), ("PUT", "/credential")],
)
def test_the_session_routes_of_pms_are_gone(method, path):
    with make_test_client(MagicMock(commit=AsyncMock())) as client:
        res = client.request(method, f"/api/v1/pms{path}", json={})
    assert res.status_code in (404, 405)
