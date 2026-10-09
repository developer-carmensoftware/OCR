"""CA-119 — POST /api/v1/pms/process/run, the retry sweep pg_cron calls."""

from unittest.mock import AsyncMock, MagicMock, patch

from tests.integration.conftest import make_test_client

URL = "/api/v1/pms/process/run"


def _call(headers):
    sweep = AsyncMock(return_value={"status": "ok", "requeued": 0, "pending_review": 2})
    with (
        patch("app.routers.admin.deps.settings.internal_job_token", "job-token"),
        patch("app.routers.pms.process.run_pms_processing", sweep),
        make_test_client(MagicMock()) as client,
    ):
        return client.post(URL, headers=headers), sweep


def test_the_job_token_runs_the_sweep():
    res, sweep = _call({"Authorization": "Bearer job-token"})
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "requeued": 0, "pending_review": 2}
    sweep.assert_awaited_once()


def test_anyone_else_is_refused():
    res, sweep = _call({})
    assert res.status_code == 401
    res, _ = _call({"Authorization": "Bearer cpk_a-pms-key"})
    assert res.status_code in (401, 403)
    sweep.assert_not_awaited()
