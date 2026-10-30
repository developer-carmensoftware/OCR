"""POST /api/v1/carmen/email-ingest/purge — the daily mailbox retention job.

What it moves is pinned against a fake mailbox in test_email_ingest_pipeline.py; these pin
who may start it and that a dry run stays a dry run.
"""

from unittest.mock import AsyncMock, MagicMock, patch

from tests.integration.conftest import make_test_client

URL = "/api/v1/carmen/email-ingest/purge"


def _call(headers, query=""):
    purge = AsyncMock(return_value={"status": "completed", "messages": 4})
    with (
        patch("app.routers.admin.deps.settings.internal_job_token", "job-token"),
        patch("app.services.email_automation.ingest.purge_mailbox", purge),
        make_test_client(MagicMock()) as client,
    ):
        return client.post(URL + query, headers=headers), purge


def test_the_job_token_runs_it():
    res, purge = _call({"Authorization": "Bearer job-token"})
    assert res.status_code == 200
    assert res.json()["messages"] == 4
    assert purge.await_args.kwargs == {"dry_run": False}


def test_a_dry_run_is_passed_through():
    _, purge = _call({"Authorization": "Bearer job-token"}, "?dry_run=true")
    assert purge.await_args.kwargs == {"dry_run": True}


def test_anyone_else_is_refused():
    res, purge = _call({})
    assert res.status_code == 401
    res, _ = _call({"Authorization": "Bearer not-the-token"})
    assert res.status_code in (401, 403)
    purge.assert_not_awaited()
