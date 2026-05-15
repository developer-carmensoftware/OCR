"""
Integration tests for POST /api/v1/feedback/correction(s)
Sync test functions using starlette TestClient as a context manager.
"""

from unittest.mock import MagicMock

from tests.conftest import make_mock_db
from tests.integration.conftest import make_test_client

BASE = "/api/v1/feedback"
AUTH = {"Authorization": "Bearer dummy"}

CORRECTION = {
    "doc_no": "DOC-001",
    "bank_code": "KBANK",
    "field_name": "company_name",
    "original_value": "Old Co",
    "corrected_value": "New Co",
}


def _fake_record():
    r = MagicMock()
    r.id = 42
    r.skipped = False
    r.doc_no = "DOC-001"
    r.bank_code = "KBANK"
    r.field_name = "company_name"
    r.original_value = "Old Co"
    r.corrected_value = "New Co"
    r.created_at = None
    return r


# ── I2: POST /correction (single) ────────────────────────────────────────────


def test_I2_1_single_correction_returns_200():
    mock_db = make_mock_db()
    mock_db.get.return_value = _fake_record()
    with make_test_client(mock_db) as client:
        resp = client.post(f"{BASE}/correction", json=CORRECTION, headers=AUTH)
        assert resp.status_code == 200


def test_I2_1_single_correction_response_fields():
    mock_db = make_mock_db()
    mock_db.get.return_value = _fake_record()
    with make_test_client(mock_db) as client:
        resp = client.post(f"{BASE}/correction", json=CORRECTION, headers=AUTH)
        body = resp.json()
        assert body["skipped"] is False
        assert body["field_name"] == "company_name"


def test_I2_2_original_equals_corrected_returns_skipped():
    mock_db = make_mock_db()
    payload = {**CORRECTION, "corrected_value": CORRECTION["original_value"]}
    with make_test_client(mock_db) as client:
        resp = client.post(f"{BASE}/correction", json=payload, headers=AUTH)
        assert resp.status_code == 200
        assert resp.json()["skipped"] is True


def test_single_correction_missing_field_returns_422():
    mock_db = make_mock_db()
    with make_test_client(mock_db) as client:
        resp = client.post(f"{BASE}/correction", json={"doc_no": "X"}, headers=AUTH)
        assert resp.status_code == 422


# ── I2: POST /corrections (batch) ─────────────────────────────────────────────


def test_I2_1_batch_one_changed_saved_1_skipped_0():
    mock_db = make_mock_db()
    with make_test_client(mock_db) as client:
        resp = client.post(f"{BASE}/corrections", json={"corrections": [CORRECTION]}, headers=AUTH)
        assert resp.status_code == 200
        body = resp.json()
        assert body["saved"] == 1
        assert body["skipped"] == 0


def test_I2_2_batch_unchanged_skipped():
    mock_db = make_mock_db()
    unchanged = {**CORRECTION, "corrected_value": CORRECTION["original_value"]}
    with make_test_client(mock_db) as client:
        resp = client.post(f"{BASE}/corrections", json={"corrections": [unchanged]}, headers=AUTH)
        body = resp.json()
        assert body["saved"] == 0
        assert body["skipped"] == 1


def test_I2_3_batch_mixed_counts_correct():
    mock_db = make_mock_db()
    unchanged = {
        **CORRECTION,
        "field_name": "doc_no",
        "original_value": "A",
        "corrected_value": "A",
    }
    with make_test_client(mock_db) as client:
        resp = client.post(
            f"{BASE}/corrections", json={"corrections": [CORRECTION, unchanged]}, headers=AUTH
        )
        body = resp.json()
        assert body["saved"] == 1
        assert body["skipped"] == 1


def test_batch_empty_returns_zero_counts():
    mock_db = make_mock_db()
    with make_test_client(mock_db) as client:
        resp = client.post(f"{BASE}/corrections", json={"corrections": []}, headers=AUTH)
        body = resp.json()
        assert body["saved"] == 0
        assert body["skipped"] == 0


def test_batch_commit_not_called_when_all_skipped():
    mock_db = make_mock_db()
    unchanged = {**CORRECTION, "corrected_value": CORRECTION["original_value"]}
    with make_test_client(mock_db) as client:
        client.post(f"{BASE}/corrections", json={"corrections": [unchanged]}, headers=AUTH)
    mock_db.commit.assert_not_called()


def test_I2_4_upsert_execute_called_for_changed_rows():
    mock_db = make_mock_db()
    with make_test_client(mock_db) as client:
        client.post(f"{BASE}/corrections", json={"corrections": [CORRECTION]}, headers=AUTH)
    mock_db.execute.assert_called()
