"""CA-93 — the per-tenant API key Carmen's PMS webhook authenticates with.

What is pinned: a key only works for its own scope and not after it expires, a new key
for a BU and PMS replaces the old one, and the plaintext hashes to the stored row. Revoked
keys and dead tenants are filtered in the SQL, which a mock DB cannot exercise — run
against the dev DB instead.
"""

import hashlib
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.auth.admin_session import AdminPrincipal
from app.exceptions import ConflictError
from app.services.shared import api_keys


def _key(**kw):
    fields = {
        "id": uuid4(),
        "tenant_id": uuid4(),
        "scopes": [api_keys.PMS_SCOPE],
        "expires_at": None,
    }
    return SimpleNamespace(**{**fields, **kw})


# ── the key ───────────────────────────────────────────────────────────────────


def test_generated_key_hashes_to_what_is_stored():
    plaintext, prefix, digest = api_keys.generate()
    assert plaintext.startswith("cpk_") and len(plaintext) > 40
    assert prefix == plaintext[:12]
    assert digest == hashlib.sha256(plaintext.encode()).hexdigest()
    assert api_keys.generate()[0] != plaintext


@pytest.mark.asyncio
async def test_authenticate_accepts_a_live_key_and_stamps_last_used():
    db = MagicMock(scalar=AsyncMock(return_value=_key()), execute=AsyncMock())
    assert await api_keys.authenticate(db, "cpk_x", api_keys.PMS_SCOPE, "1.2.3.4") is not None
    db.execute.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "found",
    [
        None,  # unknown, revoked, or tenant gone — the query returns nothing
        _key(scopes=["something:else"]),
        _key(expires_at=datetime.now(UTC) - timedelta(seconds=1)),
    ],
)
async def test_authenticate_refuses_without_stamping(found):
    db = MagicMock(scalar=AsyncMock(return_value=found), execute=AsyncMock())
    assert await api_keys.authenticate(db, "cpk_x", api_keys.PMS_SCOPE, None) is None
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_authenticate_with_no_token_never_queries():
    db = MagicMock(scalar=AsyncMock(), execute=AsyncMock())
    assert await api_keys.authenticate(db, "", api_keys.PMS_SCOPE, None) is None
    db.scalar.assert_not_awaited()


# ── issue: one live key per BU and PMS (decision-log #44) ──────────────────────


@pytest.mark.asyncio
async def test_issue_revokes_the_previous_key_and_stores_only_the_new_hash():
    tenant_id = uuid4()
    db = MagicMock(
        scalar=AsyncMock(return_value=tenant_id),
        execute=AsyncMock(return_value=MagicMock(rowcount=1)),
        flush=AsyncMock(),
    )
    key, plaintext = await api_keys.issue(
        db, tenant_id, "comanche hook", "comanche", actor="user:u-1"
    )
    revoke = db.execute.await_args.args[0]  # the UPDATE that revokes the key it replaces
    params = revoke.compile().params
    assert revoke.table.name == "api_keys"
    assert (params["tenant_id_1"], params["interface_name_1"]) == (tenant_id, "comanche")
    stored = db.add.call_args.args[0]
    assert stored is key
    assert (stored.interface_name, stored.scopes) == ("comanche", [api_keys.PMS_SCOPE])
    assert stored.key_hash == api_keys.hash_key(plaintext)


@pytest.mark.asyncio
async def test_two_generates_at_once_is_a_conflict():
    db = MagicMock(
        scalar=AsyncMock(return_value=uuid4()),
        execute=AsyncMock(return_value=MagicMock(rowcount=0)),
        flush=AsyncMock(side_effect=IntegrityError("insert", {}, Exception("unique"))),
    )
    with pytest.raises(ConflictError):
        await api_keys.issue(db, uuid4(), "comanche hook", "comanche", actor="user:u-1")


# ── admin: revoke ─────────────────────────────────────────────────────────────


def _admin(tenant_scope=""):
    return AdminPrincipal(
        admin_id="a-1",
        username="alice",
        roles=["admin"],
        perms={"api_keys:read", "api_keys:revoke"},
        tenant_scope=tenant_scope,
    )


_REQUEST = SimpleNamespace(client=SimpleNamespace(host="203.0.113.9"), headers={})


@pytest.mark.asyncio
async def test_revoking_a_key_that_is_not_live_is_404():
    from app.routers.admin.api_keys import revoke_api_key

    db = MagicMock(execute=AsyncMock(return_value=MagicMock(rowcount=0)), commit=AsyncMock())
    with pytest.raises(HTTPException) as exc:
        await revoke_api_key(uuid4(), _REQUEST, None, db, _admin())
    assert exc.value.status_code == 404
    db.commit.assert_not_awaited()


def test_a_row_names_its_business_unit_by_code_and_host():
    tenant_id = uuid4()
    key = SimpleNamespace(
        id=uuid4(),
        tenant_id=tenant_id,
        name="comanche hook",
        interface_name="comanche",
        key_prefix="cpk_abcdefgh",
        scopes=[api_keys.PMS_SCOPE],
        created_at=None,
        last_used_at=None,
        last_used_ip=None,
        revoked_at=None,
        revoke_reason=None,
    )
    info = {str(tenant_id): {"name": "Grand Hotel", "bu_code": "gh01", "host": "gh.carmen4.com"}}
    row = api_keys.key_row(key, info)
    assert (row["bu_code"], row["tenant_host"], row["tenant_name"]) == (
        "gh01",
        "gh.carmen4.com",
        "Grand Hotel (gh01)",
    )
    # A key with no live tenant (the old POC keys) still renders, with nothing to name.
    orphan = api_keys.key_row(SimpleNamespace(**{**vars(key), "tenant_id": None}), info)
    assert (orphan["bu_code"], orphan["tenant_host"], orphan["tenant_name"]) == (None, None, None)
