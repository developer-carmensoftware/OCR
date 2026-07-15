"""
Integration tests for the consent endpoints (PDPA ม.19 evidence).

  POST /api/v1/consent          — append one consent record
  GET  /api/v1/consent/status   — has this tenant consented to a version?

This is the legal-evidence write path: `consent_logs` is what proves who consented,
when, and to which version, and useUserConsent.ts treats localStorage as a cache only.
A regression that silently stops recording would leave the consent modal working while
the evidence quietly disappears — so the write itself is asserted, not just the status.
"""

from tests.conftest import make_mock_db
from tests.integration.conftest import FAKE_SESSION, make_test_client

BASE = "/api/v1/consent"
AUTH = {"Authorization": "Bearer dummy"}


# ── POST /consent ────────────────────────────────────────────────────────────


def test_C1_1_record_consent_returns_201_and_consented():
    mock_db = make_mock_db()
    with make_test_client(mock_db) as client:
        resp = client.post(BASE, json={"version": "v2"}, headers=AUTH)

    assert resp.status_code == 201
    assert resp.json() == {"consented": True}


def test_C1_2_record_consent_persists_a_row_with_tenant_version_and_client_meta():
    mock_db = make_mock_db()
    with make_test_client(mock_db) as client:
        resp = client.post(
            BASE,
            json={"version": "v2"},
            headers={**AUTH, "User-Agent": "pytest-agent/1.0"},
        )
    assert resp.status_code == 201

    # The row must actually be added AND committed — an append-only evidence log that
    # rolls back is indistinguishable from never consenting.
    mock_db.add.assert_called_once()
    mock_db.commit.assert_awaited()

    row = mock_db.add.call_args.args[0]
    assert row.tenant_id == FAKE_SESSION.tenant_id
    assert row.consent_version == "v2"
    assert row.carmen_user_id == FAKE_SESSION.carmen_user_id
    assert row.user_agent == "pytest-agent/1.0"


def test_C1_3_record_consent_rejects_missing_version():
    mock_db = make_mock_db()
    with make_test_client(mock_db) as client:
        resp = client.post(BASE, json={}, headers=AUTH)

    assert resp.status_code == 422
    mock_db.add.assert_not_called()


# ── GET /consent/status ──────────────────────────────────────────────────────


def test_C2_1_status_true_when_a_record_exists():
    mock_db = make_mock_db()
    mock_db.scalar.return_value = 1  # an existing consent_logs.id
    with make_test_client(mock_db) as client:
        resp = client.get(f"{BASE}/status", params={"version": "v2"}, headers=AUTH)

    assert resp.status_code == 200
    assert resp.json() == {"consented": True}


def test_C2_2_status_false_when_no_record_for_that_version():
    mock_db = make_mock_db()
    mock_db.scalar.return_value = None
    with make_test_client(mock_db) as client:
        resp = client.get(f"{BASE}/status", params={"version": "v99"}, headers=AUTH)

    assert resp.status_code == 200
    assert resp.json() == {"consented": False}


def test_C2_3_status_requires_a_version():
    mock_db = make_mock_db()
    with make_test_client(mock_db) as client:
        resp = client.get(f"{BASE}/status", headers=AUTH)

    assert resp.status_code == 422
