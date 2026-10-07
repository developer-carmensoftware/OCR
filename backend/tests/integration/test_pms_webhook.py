"""CA-93 — POST /api/v1/pms/events, the contract with Carmen.

401 / 413 / 422 / 202 new / 200 retry, and the `Bearer ` label being optional. The key
itself is pinned in tests/unit/test_api_keys.py; here `authenticate` is patched.
"""

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.services.shared.api_keys import PMS_SCOPE
from tests.integration.conftest import make_test_client

URL = "/api/v1/pms/events"
EVENT = {"event_id": "na-2026-10-06", "type": "night_audit", "data": {"revenue": 1200}}


def _key():
    return SimpleNamespace(id=uuid4(), tenant_id=uuid4(), scopes=[PMS_SCOPE], expires_at=None)


def _db(*scalars):
    return MagicMock(scalar=AsyncMock(side_effect=list(scalars)), commit=AsyncMock())


def _post(db, key, body=None, auth="Bearer cpk_good"):
    with (
        patch("app.routers.pms.authenticate", AsyncMock(return_value=key)) as auth_mock,
        make_test_client(db) as client,
    ):
        headers = {"Authorization": auth} if auth else {}
        content = body if body is not None else json.dumps(EVENT)
        res = client.post(URL, content=content, headers=headers)
    return res, auth_mock


def test_unknown_key_is_401():
    res, _ = _post(_db(), key=None)
    assert res.status_code == 401


@pytest.mark.parametrize("header", ["Bearer cpk_good", "cpk_good"])
def test_bearer_label_is_optional(header):
    res, auth_mock = _post(_db(uuid4()), _key(), auth=header)
    assert res.status_code == 202
    assert auth_mock.await_args.args[1] == "cpk_good"


def test_new_event_is_stored_and_202():
    new_id = uuid4()
    db = _db(new_id)
    res, _ = _post(db, _key())
    assert res.status_code == 202
    assert res.json() == {"id": str(new_id), "duplicate": False}
    db.commit.assert_awaited_once()


def test_retried_event_answers_with_the_first_row():
    first_id = uuid4()
    res, _ = _post(_db(None, first_id), _key())  # insert hits the conflict, then the lookup
    assert res.status_code == 200
    assert res.json() == {"id": str(first_id), "duplicate": True}


def test_body_over_1mb_is_413():
    big = json.dumps({**EVENT, "data": {"blob": "x" * (1024 * 1024)}})
    res, _ = _post(_db(), _key(), body=big)
    assert res.status_code == 413


@pytest.mark.parametrize(
    "body",
    [
        json.dumps({"type": "night_audit", "data": {}}),  # no event_id
        json.dumps({**EVENT, "data": [1, 2]}),  # data must be an object
        "not json",
    ],
)
def test_bad_envelope_is_422(body):
    res, _ = _post(_db(), _key(), body=body)
    assert res.status_code == 422
