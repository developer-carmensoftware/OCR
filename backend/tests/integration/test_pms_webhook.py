"""CA-93 — POST /api/v1/pms/events, the contract with Carmen.

401 / 413 / 422 / 202 new / 200 repeat, and the `Bearer ` label being optional. The key
itself is pinned in tests/unit/test_api_keys.py; here `authenticate` is patched.
"""

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.models.schemas.pms import PmsEventIn
from app.services.shared.api_keys import PMS_SCOPE
from tests.integration.conftest import make_test_client

URL = "/api/v1/pms/events"
# Carmen's hook as they sent it to us (minus the sample's trailing comma).
EVENT = {
    "InterfaceType": "PMS",
    "InterfaceName": "Comanche",
    "DocType": "Daily",
    "DocDate": "2026-10-07",
}


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


def test_repeated_day_answers_with_the_same_row():
    first_id = uuid4()
    res, _ = _post(_db(None, first_id), _key())  # insert hits the conflict, then the update
    assert res.status_code == 200
    assert res.json() == {"id": str(first_id), "duplicate": True}


def test_body_over_16kb_is_413():
    big = json.dumps({**EVENT, "Padding": "x" * (16 * 1024)})
    res, _ = _post(_db(), _key(), body=big)
    assert res.status_code == 413


@pytest.mark.parametrize(
    "body",
    [
        json.dumps({k: v for k, v in EVENT.items() if k != "DocDate"}),  # DocDate missing
        json.dumps({**EVENT, "DocDate": "2026-13-40"}),  # not a date
        json.dumps({**EVENT, "InterfaceType": "POS"}),  # this endpoint is PMS only
        json.dumps({**EVENT, "InterfaceName": "Coman/che"}),  # "/" would blur the row key
        json.dumps(
            {
                "interfaceType": "PMS",
                "interfaceName": "Comanche",
                "docType": "Daily",
                "docDate": "2026-10-07",
            }
        ),
        '{"InterfaceType": "PMS", "InterfaceName": "Comanche", "DocType": "Daily", "DocDate": "2026-10-07",}',
        "not json",
    ],
    ids=["no-date", "bad-date", "not-pms", "slash", "camelCase", "trailing-comma", "not-json"],
)
def test_bad_hook_is_422(body):
    res, _ = _post(_db(), _key(), body=body)
    assert res.status_code == 422


@pytest.mark.parametrize("doc_date", ["2026-10-07", "2026-10-07T00:00:00"])
def test_one_key_per_bu_day_whatever_the_date_format(doc_date):
    event = PmsEventIn.model_validate({**EVENT, "DocDate": doc_date})
    assert event.key == "PMS/Comanche/Daily/2026-10-07"
    assert event.model_dump(by_alias=True, mode="json") == EVENT
