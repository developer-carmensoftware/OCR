"""Admin Email Automation endpoints — permission gates and the poll's answer shapes.

The read gate and the write gate are deliberately different permissions, and the poll
endpoint answers four ways rather than one. Both are the kind of thing that looks
arbitrary six months later and gets "simplified" into a bug, so they are pinned here.
"""

import asyncio
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from app.auth.admin_session import AdminPrincipal
from app.routers.admin import email_ingest as ei
from app.routers.admin.deps import require_permission


def _admin(*perms: str) -> AdminPrincipal:
    return AdminPrincipal(admin_id="a1", username="ops", roles=["admin"], perms=set(perms))


class TestPermissionGates:
    """`viewer` holds every `*:read` permission — that is what makes the split matter."""

    def test_documents_need_only_a_read_permission(self):
        require_permission("tenants", "read")(admin=_admin("tenants:read"))

    def test_business_units_need_configs_write(self):
        """The row carries the ingest tag, and the tag is the authority to write
        documents into that BU's ledger and spend its credits. A read gate would hand
        that to every viewer."""
        with pytest.raises(HTTPException) as exc:
            require_permission("configs", "write")(admin=_admin("tenants:read", "configs:read"))
        assert exc.value.status_code == 403

        require_permission("configs", "write")(admin=_admin("configs:write"))

    def test_poll_needs_configs_write(self):
        with pytest.raises(HTTPException) as exc:
            require_permission("configs", "write")(admin=_admin("tenants:read"))
        assert exc.value.status_code == 403


class TestPollNow:
    @pytest.mark.asyncio
    async def test_an_unconfigured_mailbox_says_so_instead_of_running(self):
        with patch.object(ei.settings, "imap_host", ""):
            assert await ei.poll_now(limit=None, _admin=_admin("configs:write")) == {
                "status": "disabled",
                "reason": "IMAP not configured",
            }

    @pytest.mark.asyncio
    async def test_a_fast_poll_returns_its_summary(self):
        summary = {"messages": 1, "posted": 1, "failed": 0, "skipped": 0, "unrouted": 0}
        with (
            patch.object(ei.settings, "imap_host", "imap.example.com"),
            patch.object(ei.ingest, "run_ingest", AsyncMock(return_value=summary)),
        ):
            assert await ei.poll_now(limit=None, _admin=_admin("configs:write")) == summary

    @pytest.mark.asyncio
    async def test_a_slow_poll_answers_running_without_cancelling_the_work(self):
        """The whole point of `asyncio.shield`. `adminFetch` aborts at 30s, so the wait
        is bounded here — but cancelling a poll mid-document would abandon a charged
        credit and a half-posted JV, so the work must outlive the response."""
        finished = asyncio.Event()

        async def _slow(_limit=None):
            await asyncio.sleep(0.05)
            finished.set()
            return {"messages": 9}

        with (
            patch.object(ei.settings, "imap_host", "imap.example.com"),
            patch.object(ei, "POLL_WAIT_SECONDS", 0.01),
            patch.object(ei.ingest, "run_ingest", _slow),
        ):
            assert await ei.poll_now(limit=None, _admin=_admin("configs:write")) == {
                "status": "running"
            }
            await asyncio.wait_for(finished.wait(), timeout=1)

    @pytest.mark.asyncio
    async def test_the_confirmation_sweep_is_passed_through_untouched(self):
        result = {"checked": 1, "confirmed": 1, "waiting": 2}
        with patch.object(ei.ingest, "sweep_confirmations", AsyncMock(return_value=result)):
            assert await ei.sweep_confirmations_now(_admin=_admin("configs:write")) == result
