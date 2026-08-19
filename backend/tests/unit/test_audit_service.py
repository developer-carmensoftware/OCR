"""audit_service: the buffered write queue and its never-raise contract.

Audit logging sits on the hot path of every extract/submit. Two properties keep it
there safely: it must never propagate an exception into the request, and the buffer
must not grow without bound when the flush task is wedged.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.context import current_document_ref, current_ocr_session_id
from app.services import audit_service as aud


@pytest.fixture(autouse=True)
def _clean_buffer():
    aud._AUDIT_BUFFER.clear()
    current_ocr_session_id.set("")
    current_document_ref.set("")
    yield
    aud._AUDIT_BUFFER.clear()
    current_ocr_session_id.set("")
    current_document_ref.set("")


def _session(tenant_id="t-001", carmen_user_id="u-1", username="alice"):
    return SimpleNamespace(tenant_id=tenant_id, carmen_user_id=carmen_user_id, username=username)


# ── log_action ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_log_action_buffers_a_row_instead_of_writing():
    await aud.log_action(_session(), aud.AuditAction.EXTRACT, resource="credit_card")

    assert len(aud._AUDIT_BUFFER) == 1
    row = aud._AUDIT_BUFFER[0]
    assert row["action"] == "EXTRACT"
    assert row["tenant_id"] == "t-001"
    assert row["carmen_user_id"] == "u-1"
    assert row["admin_user_id"] is None


@pytest.mark.asyncio
async def test_log_action_falls_back_to_the_document_ref_context_var():
    """resource_id is usually implied by what the request is working on rather
    than passed explicitly."""
    current_document_ref.set("DOC-42")
    await aud.log_action(_session(), aud.AuditAction.SUBMIT)

    assert aud._AUDIT_BUFFER[0]["resource_id"] == "DOC-42"


@pytest.mark.asyncio
async def test_explicit_resource_id_wins_over_the_context_var():
    current_document_ref.set("DOC-42")
    await aud.log_action(_session(), aud.AuditAction.SUBMIT, resource_id="DOC-99")

    assert aud._AUDIT_BUFFER[0]["resource_id"] == "DOC-99"


@pytest.mark.asyncio
async def test_blank_identity_fields_become_null():
    """Empty strings would defeat `WHERE carmen_user_id IS NULL` reporting."""
    await aud.log_action(_session(tenant_id="", carmen_user_id="", username=""), "LOGIN")

    row = aud._AUDIT_BUFFER[0]
    assert row["tenant_id"] is None
    assert row["carmen_user_id"] is None
    assert row["username"] is None


@pytest.mark.asyncio
async def test_log_action_never_raises_into_the_request():
    """A broken audit write must not fail the user's extract."""
    broken = SimpleNamespace()  # no attributes at all → AttributeError inside

    await aud.log_action(broken, "EXTRACT")  # must not raise

    assert aud._AUDIT_BUFFER == []


@pytest.mark.asyncio
async def test_log_admin_action_records_the_before_after_diff():
    await aud.log_admin_action(
        "admin-1",
        aud.AuditAction.MODULE_TOGGLE,
        target_type="module",
        target_id="ap_invoice",
        before_value={"enabled": True},
        after_value={"enabled": False},
    )

    row = aud._AUDIT_BUFFER[0]
    assert row["admin_user_id"] == "admin-1"
    assert row["carmen_user_id"] is None
    assert row["before_value"] == {"enabled": True}
    assert row["after_value"] == {"enabled": False}


# ── Buffer bounds ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_buffer_drops_oldest_rows_past_the_hard_cap():
    """If the flush task dies, the buffer must shed rows rather than the process.

    Async because crossing _FLUSH_SIZE makes _enqueue schedule a flush, which
    needs a running loop.
    """
    aud._AUDIT_BUFFER.extend({"action": f"A{i}"} for i in range(aud._BUFFER_HARD_CAP))

    with patch.object(aud, "flush_audit_buffer", AsyncMock()):
        aud._enqueue({"action": "NEWEST"})

    assert len(aud._AUDIT_BUFFER) == aud._BUFFER_HARD_CAP
    assert aud._AUDIT_BUFFER[-1]["action"] == "NEWEST"
    assert aud._AUDIT_BUFFER[0]["action"] == "A1"  # A0 was dropped


@pytest.mark.asyncio
async def test_crossing_the_flush_size_schedules_a_flush():
    aud._AUDIT_BUFFER.extend({"action": "X"} for _ in range(aud._FLUSH_SIZE - 1))

    with patch.object(aud, "flush_audit_buffer", AsyncMock()) as flush:
        aud._enqueue({"action": "TRIGGER"})

    flush.assert_called_once()


@pytest.mark.asyncio
async def test_a_quiet_buffer_does_not_schedule_a_flush():
    with patch.object(aud, "flush_audit_buffer", AsyncMock()) as flush:
        aud._enqueue({"action": "ONE"})

    flush.assert_not_called()


# ── flush ─────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_flush_on_an_empty_buffer_opens_no_session():
    with patch.object(aud, "async_session") as sess:
        await aud.flush_audit_buffer()
    sess.assert_not_called()


@pytest.mark.asyncio
async def test_flush_drains_the_buffer_and_commits_one_batch():
    aud._AUDIT_BUFFER.extend([{"action": "EXTRACT"}, {"action": "SUBMIT"}])

    db = AsyncMock()
    db.add_all = MagicMock()
    ctx = MagicMock()
    ctx.__aenter__ = AsyncMock(return_value=db)
    ctx.__aexit__ = AsyncMock(return_value=False)

    with patch.object(aud, "async_session", return_value=ctx):
        with patch.object(aud, "AuditLog", lambda **kw: kw):
            await aud.flush_audit_buffer()

    assert aud._AUDIT_BUFFER == []
    db.add_all.assert_called_once()
    assert len(db.add_all.call_args.args[0]) == 2
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_a_failing_flush_does_not_raise_and_does_not_requeue():
    """Documented trade-off: the batch is taken before the write, so a DB failure
    drops those rows rather than growing the buffer forever. Pin it so the
    behaviour is a decision, not a surprise."""
    aud._AUDIT_BUFFER.append({"action": "EXTRACT"})

    with patch.object(aud, "async_session", side_effect=RuntimeError("db down")):
        await aud.flush_audit_buffer()  # must not raise

    assert aud._AUDIT_BUFFER == []
