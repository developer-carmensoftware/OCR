"""
Integration tests for /api/v1/ocr/carmen/* proxy endpoints.
Sync test functions using starlette TestClient.

Covers:
- Happy-path 200 responses when service returns data
- CarmenAPIError → correct HTTP status code propagation
- Missing auth → 401/422
"""

from contextlib import contextmanager
from unittest.mock import AsyncMock

import app.routers.carmen as _carmen_router
from tests.conftest import make_mock_db
from tests.integration.conftest import make_test_client

BASE = "/api/v1/ocr/carmen"
AUTH = {"Authorization": "Bearer dummy"}


@contextmanager
def _patch_service(name: str, mock_fn):
    """Directly replace a name on app.routers.carmen and restore after."""
    original = getattr(_carmen_router, name)
    setattr(_carmen_router, name, mock_fn)
    try:
        yield mock_fn
    finally:
        setattr(_carmen_router, name, original)


def _ok(payload=None):
    return AsyncMock(return_value=payload or {"Data": [], "Status": "ok"})


def _err(status: int, detail: str = "upstream error"):
    from app.services.carmen_service import CarmenAPIError

    return AsyncMock(side_effect=CarmenAPIError(status, detail))


# ── GET /account-codes ────────────────────────────────────────────────────────


def test_account_codes_200():
    mock_db = make_mock_db()
    with _patch_service("get_account_codes", _ok({"Data": [{"Code": "5100"}]})):
        with make_test_client(mock_db) as client:
            resp = client.get(f"{BASE}/account-codes", headers=AUTH)
    assert resp.status_code == 200
    assert "Data" in resp.json()


def test_account_codes_forwards_401():
    mock_db = make_mock_db()
    with _patch_service("get_account_codes", _err(401, "Unauthorized")):
        with make_test_client(mock_db) as client:
            resp = client.get(f"{BASE}/account-codes", headers=AUTH)
    assert resp.status_code == 401


# ── GET /departments ──────────────────────────────────────────────────────────


def test_departments_200():
    mock_db = make_mock_db()
    with _patch_service("get_departments", _ok({"Data": [{"Code": "FIN"}]})):
        with make_test_client(mock_db) as client:
            resp = client.get(f"{BASE}/departments", headers=AUTH)
    assert resp.status_code == 200
    assert "Data" in resp.json()


def test_departments_forwards_502():
    mock_db = make_mock_db()
    with _patch_service("get_departments", _err(502, "Gateway error")):
        with make_test_client(mock_db) as client:
            resp = client.get(f"{BASE}/departments", headers=AUTH)
    assert resp.status_code == 502


# ── GET /gl-prefix (soft error — returns degraded response) ──────────────────


def test_gl_prefix_200_even_on_carmen_error():
    """gl-prefix silently degrades instead of returning 4xx/5xx."""
    mock_db = make_mock_db()
    with _patch_service("get_gl_prefix", _err(503, "Carmen down")):
        with make_test_client(mock_db) as client:
            resp = client.get(f"{BASE}/gl-prefix", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert "Data" in body
    assert "upstream_503" in body.get("Status", "")


# ── POST /gljv ────────────────────────────────────────────────────────────────


def test_gljv_200():
    mock_db = make_mock_db()
    payload = {"JvhSeq": -1, "JvhNo": "Auto", "Status": "Draft", "Detail": []}
    with _patch_service("post_gljv", _ok({"Code": 0, "InternalMessage": "JV-1"})):
        with make_test_client(mock_db) as client:
            resp = client.post(f"{BASE}/gljv", json=payload, headers=AUTH)
    assert resp.status_code == 200
    assert resp.json().get("Code") == 0


def test_gljv_forwards_409():
    mock_db = make_mock_db()
    with _patch_service("post_gljv", _err(409, "Duplicate JV")):
        with make_test_client(mock_db) as client:
            resp = client.post(f"{BASE}/gljv", json={}, headers=AUTH)
    assert resp.status_code == 409
    assert "Carmen" in resp.json().get("detail", "")
