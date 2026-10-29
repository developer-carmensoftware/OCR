"""POST /api/v1/admin/encryption/backfill — the once-per-environment backfill.

The work itself is pinned against Postgres in tests/tenancy/test_review_payload_encryption.py;
these pin who may start it and that a dry run stays a dry run.
"""

from unittest.mock import AsyncMock, MagicMock, patch

from tests.integration.conftest import make_test_client

URL = "/api/v1/admin/encryption/backfill"
FOUND = {"email_documents.review_payload": 3, "correction_feedback.original_value": 1}


def _call(headers, query=""):
    backfill = AsyncMock(return_value=FOUND)
    with (
        patch("app.routers.admin.deps.settings.internal_job_token", "job-token"),
        patch("app.services.shared.payload_encryption.encrypt_plaintext_columns", backfill),
        make_test_client(MagicMock()) as client,
    ):
        return client.post(URL + query, headers=headers), backfill


def test_the_job_token_encrypts_and_says_how_many():
    res, backfill = _call({"Authorization": "Bearer job-token"})
    assert res.status_code == 200
    assert res.json() == {"status": "completed", "plaintext_rows": FOUND}
    assert backfill.await_args.kwargs == {"dry_run": False}


def test_a_dry_run_only_counts():
    res, backfill = _call({"Authorization": "Bearer job-token"}, "?dry_run=true")
    assert res.json()["status"] == "dry_run"
    assert backfill.await_args.kwargs == {"dry_run": True}


def test_anyone_else_is_refused():
    res, backfill = _call({})
    assert res.status_code == 401
    res, _ = _call({"Authorization": "Bearer not-the-token"})
    assert res.status_code in (401, 403)
    backfill.assert_not_awaited()
