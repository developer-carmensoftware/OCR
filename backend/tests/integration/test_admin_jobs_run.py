"""Run-now on the Jobs page: who may press it, and that email-ingest really runs."""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.auth.admin_session import AdminPrincipal
from app.models.schemas.ocr import CorrectionFeedbackBatchRequest
from app.routers.admin import monitoring as mon
from app.routers.admin.deps import require_permission


def _admin(*perms: str, scope: str = "") -> AdminPrincipal:
    return AdminPrincipal(
        admin_id="a1", username="ops", roles=["admin"], perms=set(perms), tenant_scope=scope
    )


def test_viewer_cannot_run_a_job():
    """`viewer` holds every *:read permission, including the old gate (tenants:read)."""
    with pytest.raises(HTTPException) as exc:
        require_permission("configs", "write")(admin=_admin("tenants:read"))
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_bu_scoped_admin_is_refused():
    with pytest.raises(HTTPException) as exc:
        await mon.trigger_job_run(
            "email-ingest", db=AsyncMock(), admin=_admin("configs:write", scope="t1")
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_email_ingest_goes_through_poll_now_and_is_audited():
    with (
        patch(
            "app.routers.admin.email_ingest.poll_now",
            AsyncMock(return_value={"status": "disabled"}),
        ) as poll,
        patch.object(mon, "log_admin_action", AsyncMock()) as audit,
    ):
        out = await mon.trigger_job_run(
            "email-ingest", db=AsyncMock(), admin=_admin("configs:write")
        )
    poll.assert_awaited_once()
    assert out["result"] == {"status": "disabled"}
    assert audit.await_args.kwargs["target_id"] == "email-ingest"


@pytest.mark.asyncio
async def test_unknown_job_is_400():
    with patch.object(mon, "log_admin_action", AsyncMock()):
        with pytest.raises(HTTPException) as exc:
            await mon.trigger_job_run("nope", db=AsyncMock(), admin=_admin("configs:write"))
    assert exc.value.status_code == 400


def test_corrections_batch_is_capped():
    row = {
        "doc_no": "d",
        "bank_code": "BBL",
        "field_name": "doc_no",
        "original_value": "a",
        "corrected_value": "b",
    }
    CorrectionFeedbackBatchRequest(corrections=[row] * 200)
    with pytest.raises(ValidationError):
        CorrectionFeedbackBatchRequest(corrections=[row] * 201)
    with pytest.raises(ValidationError):
        CorrectionFeedbackBatchRequest(corrections=[{**row, "doc_no": "x" * 101}])
