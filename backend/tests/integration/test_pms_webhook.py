"""CA-93 — POST /api/v1/pms/events, the contract with Carmen.

Built to settle, before Carmen sends anything, every way a real sender can differ from the
sample: auth header forms, body variants a .NET client produces, content types, the size
boundary, and the bodies that must be refused (above all a DocDate that would land on the
wrong day). The key itself is pinned in tests/unit/test_api_keys.py; `authenticate` is
patched here. The real-DB run is scripted separately (changelog 2026-10-08).
"""

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy.dialects import postgresql

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
DAY_KEY = "PMS/Comanche/Daily/2026-10-07"
BOM = b"\xef\xbb\xbf"


def _key():
    return SimpleNamespace(id=uuid4(), tenant_id=uuid4(), scopes=[PMS_SCOPE], expires_at=None)


def _db(*scalars):
    return MagicMock(scalar=AsyncMock(side_effect=list(scalars)), commit=AsyncMock())


def _post(db, key, body=None, auth="Bearer cpk_good", content_type="application/json"):
    with (
        patch("app.routers.pms.authenticate", AsyncMock(return_value=key)) as auth_mock,
        make_test_client(db) as client,
    ):
        headers = {"Authorization": auth} if auth is not None else {}
        if content_type is not None:
            headers["Content-Type"] = content_type
        content = body if body is not None else json.dumps(EVENT)
        res = client.post(URL, content=content, headers=headers)
    return res, auth_mock


def _inserted(db) -> dict:
    """The values the handler asked Postgres to insert."""
    stmt = db.scalar.await_args_list[0].args[0]
    return stmt.compile(dialect=postgresql.dialect()).params


# ── Auth ───────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "header",
    ["Bearer cpk_good", "bearer cpk_good", "BEARER cpk_good", "cpk_good", "Bearer  cpk_good"],
)
def test_any_bearer_form_reaches_the_same_key(header):
    res, auth_mock = _post(_db(uuid4()), _key(), auth=header)
    assert res.status_code == 202
    assert auth_mock.await_args.args[1] == "cpk_good"


@pytest.mark.parametrize("header", [None, "", "Bearer cpk_wrong"], ids=["none", "empty", "unknown"])
def test_no_or_unknown_key_is_401_and_writes_nothing(header):
    db = _db()
    res, _ = _post(db, key=None, auth=header)
    assert res.status_code == 401
    assert res.json() == {"detail": "Invalid API key"}
    assert res.headers["WWW-Authenticate"] == "Bearer"
    db.scalar.assert_not_awaited()


# ── Bodies that must be accepted, and the day they must land on ────────────────────


def _camel(d):
    return {k[0].lower() + k[1:]: v for k, v in d.items()}


@pytest.mark.parametrize(
    "body",
    [
        json.dumps(EVENT),
        json.dumps(_camel(EVENT)),
        json.dumps({k.lower(): v for k, v in EVENT.items()}),
        json.dumps({**EVENT, "InterfaceType": "pms"}),
        BOM + json.dumps(EVENT).encode(),
        json.dumps({**EVENT, "Id": 146, "Source": "", "LastModified": "2026-10-08T10:02:18+07:00"}),
        json.dumps({**EVENT, "DocDate": "2026-10-07T00:00:00"}),
        json.dumps({**EVENT, "DocDate": "2026-10-07T00:00:00+07:00"}),
        json.dumps({**EVENT, "DocDate": "2026-10-07T00:00:00.000Z"}),
        json.dumps({**EVENT, "InterfaceName": "  Comanche ", "DocDate": " 2026-10-07 "}),
    ],
    ids=[
        "pascal",
        "camel",
        "lower",
        "type-lower",
        "bom",
        "extra-fields",
        "datetime",
        "offset",
        "zulu",
        "padded",
    ],
)
def test_sender_variants_land_on_the_same_day(body):
    db = _db(uuid4())
    res, _ = _post(db, _key(), body=body)
    assert res.status_code == 202, res.text
    stored = _inserted(db)
    assert stored["event_id"] == DAY_KEY
    assert stored["type"] == "PMS"
    assert stored["payload"] == EVENT


@pytest.mark.parametrize(
    "content_type",
    [
        "application/json",
        "application/json; charset=utf-8",
        "text/plain",
        "application/x-www-form-urlencoded",
        None,
    ],
)
def test_content_type_does_not_matter(content_type):
    res, _ = _post(_db(uuid4()), _key(), content_type=content_type)
    assert res.status_code == 202


def test_new_day_is_202():
    new_id = uuid4()
    db = _db(new_id)
    res, _ = _post(db, _key())
    assert res.status_code == 202
    assert res.json() == {"id": str(new_id), "duplicate": False}
    db.commit.assert_awaited_once()


def test_same_day_again_is_200_on_the_same_row():
    first_id = uuid4()
    db = _db(None, first_id)  # the insert hits the conflict, then the update returns the row
    res, _ = _post(db, _key())
    assert res.status_code == 200
    assert res.json() == {"id": str(first_id), "duplicate": True}
    update_stmt = db.scalar.await_args_list[1].args[0]
    assert "updated_at" in str(update_stmt.compile(dialect=postgresql.dialect()))


# ── Size ───────────────────────────────────────────────────────────────────────────


def _padded(total: int) -> str:
    base = json.dumps({**EVENT, "Padding": ""})
    return json.dumps({**EVENT, "Padding": "x" * (total - len(base))})


def test_exactly_16kb_is_accepted():
    body = _padded(16 * 1024)
    assert len(body.encode()) == 16 * 1024
    res, _ = _post(_db(uuid4()), _key(), body=body)
    assert res.status_code == 202


def test_one_byte_over_16kb_is_413():
    res, _ = _post(_db(), _key(), body=_padded(16 * 1024 + 1))
    assert res.status_code == 413


# ── Bodies that must be refused, and that the refusal names the field ──────────────


@pytest.mark.parametrize(
    ("body", "field"),
    [
        ({k: v for k, v in EVENT.items() if k != "DocDate"}, "DocDate"),
        ({**EVENT, "DocDate": None}, "DocDate"),
        ({**EVENT, "DocDate": 20261007}, "DocDate"),  # would be read as unix seconds
        ({**EVENT, "DocDate": "1791331200"}, "DocDate"),  # same, as a string
        ({**EVENT, "DocDate": "07/10/2026"}, "DocDate"),  # ambiguous day/month
        ({**EVENT, "DocDate": "2026-13-40"}, "DocDate"),
        ({**EVENT, "InterfaceType": "POS"}, "InterfaceType"),
        ({**EVENT, "InterfaceName": "Coman/che"}, "InterfaceName"),
        ({**EVENT, "DocType": "Da/ily"}, "DocType"),
        ({**EVENT, "InterfaceName": "x" * 41}, "InterfaceName"),
        ({**EVENT, "DocType": "x" * 31}, "DocType"),
        ({**EVENT, "InterfaceName": "   "}, "InterfaceName"),
    ],
    ids=[
        "no-date",
        "null-date",
        "int-date",
        "epoch-string",
        "dd/mm/yyyy",
        "impossible-date",
        "not-pms",
        "slash-name",
        "slash-doctype",
        "long-name",
        "long-doctype",
        "blank-name",
    ],
)
def test_bad_field_is_422_naming_it(body, field):
    db = _db()
    res, _ = _post(db, _key(), body=json.dumps(body))
    assert res.status_code == 422
    assert field in res.json()["detail"][0]["loc"]
    db.scalar.assert_not_awaited()


@pytest.mark.parametrize(
    "body",
    [
        json.dumps([EVENT]),
        "",
        '{"InterfaceType": "PMS", "InterfaceName": "Comanche", "DocType": "Daily", "DocDate": "2026-10-07",}',
        "not json",
    ],
    ids=["array", "empty", "trailing-comma", "not-json"],
)
def test_not_one_json_object_is_422(body):
    db = _db()
    res, _ = _post(db, _key(), body=body)
    assert res.status_code == 422
    db.scalar.assert_not_awaited()


@pytest.mark.parametrize("doc_date", ["2026-10-07", "2026-10-07T00:00:00"])
def test_one_key_per_bu_day_whatever_the_date_format(doc_date):
    event = PmsEventIn.model_validate({**EVENT, "DocDate": doc_date})
    assert event.key == DAY_KEY
    assert event.model_dump(by_alias=True, mode="json") == EVENT
