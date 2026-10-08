"""CA-117 — `#/pms`: a BU manages its own PMS keys with its session.

What is pinned: every route works on the session's tenant only (the list filters by it,
create issues for it, revoke is confined to it), the plaintext comes back once, and the
2-active cap surfaces as 409. The cap itself is pinned in tests/unit/test_api_keys.py.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

from app.auth.session import SessionInfo
from app.exceptions import ConflictError
from tests.integration.conftest import make_test_client

TENANT = str(uuid4())
SESSION = SessionInfo(
    session_id="sess-pms",
    carmen_token="tok",
    carmen_user_id="3fa85f64-5717-4562-b3fc-2c963f66afa6",
    username="accountant",
    tenant_id=TENANT,
    carmen_uri="https://hotel.carmen4.com",
    bu="gh01",
)


def _key(**kw):
    fields = {
        "id": uuid4(),
        "tenant_id": UUID(TENANT),
        "name": "PMS webhook",
        "key_prefix": "cpk_abcdefgh",
        "scopes": ["pms:events"],
        "created_at": None,
        "last_used_at": None,
        "last_used_ip": None,
        "revoked_at": None,
        "revoke_reason": None,
    }
    return SimpleNamespace(**{**fields, **kw})


def _client():
    return make_test_client(MagicMock(commit=AsyncMock()), session=SESSION)


def test_the_list_is_the_sessions_bu_only():
    with (
        patch("app.routers.pms.paginate", AsyncMock(return_value=([_key()], 1))) as pg,
        patch("app.routers.pms.tenant_info_map", AsyncMock(return_value={})),
        _client() as client,
    ):
        res = client.get("/api/v1/pms/keys")
    assert res.status_code == 200
    assert res.json()["total"] == 1 and res.json()["data"][0]["key_prefix"] == "cpk_abcdefgh"
    stmt = pg.await_args.args[1]
    assert UUID(TENANT) in stmt.compile().params.values()


def test_create_issues_for_the_sessions_bu_and_returns_the_key_once():
    key = _key()
    with (
        patch("app.routers.pms.keys.issue", AsyncMock(return_value=(key, "cpk_SECRET"))) as issue,
        patch("app.routers.pms.tenant_info_map", AsyncMock(return_value={})),
        _client() as client,
    ):
        res = client.post("/api/v1/pms/keys", json={"name": "PMS webhook"})
    assert res.status_code == 201
    assert res.json()["key"] == "cpk_SECRET"
    args, kwargs = issue.await_args
    assert args[1] == UUID(TENANT)
    assert kwargs["actor"] == f"user:{SESSION.carmen_user_id}"


def test_a_third_key_is_a_409():
    with (
        patch(
            "app.routers.pms.keys.issue",
            AsyncMock(side_effect=ConflictError("already has 2 active keys")),
        ),
        _client() as client,
    ):
        res = client.post("/api/v1/pms/keys", json={})
    assert res.status_code == 409


def test_revoke_is_confined_to_the_sessions_bu():
    key_id = uuid4()
    with (
        patch("app.routers.pms.keys.revoke", AsyncMock(return_value=True)) as revoke,
        _client() as client,
    ):
        res = client.delete(f"/api/v1/pms/keys/{key_id}", params={"reason": "rotated"})
    assert res.status_code == 200
    kwargs = revoke.await_args.kwargs
    assert kwargs["tenant_id"] == UUID(TENANT)
    assert kwargs["reason"] == "rotated"


def test_another_bus_key_is_a_404():
    with (
        patch("app.routers.pms.keys.revoke", AsyncMock(return_value=False)),
        _client() as client,
    ):
        res = client.delete(f"/api/v1/pms/keys/{uuid4()}")
    assert res.status_code == 404
