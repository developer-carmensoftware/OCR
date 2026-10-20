"""CA-119 / decision-log #43 — processing one PMS day (services/pms/process.py).

The claim, the credential, Carmen and the writes are patched; what is pinned is the
decision: which days park, which go to Carmen's engine, and what a failure leaves on the
row. No side or total is computed anywhere here — those are the engine's.
"""

from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy.dialects import postgresql

from app.services.pms import carmen_config as cfg
from app.services.pms import process
from app.services.shared.carmen import CarmenAPIError
from tests.unit.test_pms_carmen_config import COMANCHE_INI, CUSTOM_INI, DAY, _setting

HOOK = {
    "InterfaceType": "PMS",
    "InterfaceName": "Comanche",
    "DocType": "Daily",
    "DocDate": "2025-10-20",
}
DATABANK = [{"Id": 148, "LastModified": "2026-10-14T14:29:34+07:00", "FileData": DAY}]
SPEC = cfg.spec_of(cfg.parse_ini(COMANCHE_INI))
ROWS = cfg.rows_of(DAY, SPEC)
# Carmen's table with every one of the day's rows mapped.
FULL = [
    {
        "Code": r["values"]["Code"],
        "Description": r["values"]["Description"],
        "DeptCode": "GEN",
        "AccCode": "1010001",
        "AccDesc": "x",
    }
    for r in ROWS
]
POSTED = {"Result": True, "RecordCount": 1, "Code": 1, "UserMessage": "Posting complete."}
AUTO = SimpleNamespace(auto_post=True)


def _claimed(attempts=1):
    return SimpleNamespace(id=uuid4(), tenant_id=uuid4(), payload=HOOK, attempts=attempts)


def _mock(value):
    return (
        AsyncMock(side_effect=value)
        if isinstance(value, Exception)
        else AsyncMock(return_value=value)
    )


class _Run:
    """One `process_event` call with everything around the decision patched."""

    def __init__(
        self,
        *,
        settings=None,
        target=("tok", "https://dev.carmen4.com"),
        carmen_settings=None,
        databank=DATABANK,
        table=FULL,
        suggest=None,
        post=POSTED,
        claimed=None,
    ):
        self.claimed = claimed or _claimed()
        self.writes: list[dict] = []
        db = MagicMock(get=AsyncMock(return_value=settings))

        @asynccontextmanager
        async def session():
            yield db

        async def write(pk, **values):
            self.writes.append(values)

        self.patches = {
            "claim": patch.object(process, "_claim", AsyncMock(return_value=self.claimed)),
            "session": patch.object(process, "async_session", session),
            "target": patch.object(process, "_target", AsyncMock(return_value=target)),
            "write": patch.object(process, "_write", write),
            "settings": patch.object(
                process.carmen,
                "get_pms_settings",
                _mock(carmen_settings if carmen_settings is not None else [_setting()]),
            ),
            "databank": patch.object(process.carmen, "get_databank_day", _mock(databank)),
            "mapping": patch.object(process.carmen, "get_pms_mapping", _mock(table)),
            "masters": patch.object(process.mapping, "masters", AsyncMock(return_value=([], []))),
            "suggest": patch.object(process.mapping, "suggest", _mock(suggest or {})),
            "post": patch.object(process.carmen, "post_pms_gl", _mock(post)),
        }

    async def __call__(self):
        self.m = {name: p.start() for name, p in self.patches.items()}
        try:
            return await process.process_event(self.claimed.id)
        finally:
            for p in self.patches.values():
                p.stop()

    @property
    def last(self) -> dict:
        return self.writes[-1]


@pytest.mark.asyncio
async def test_auto_post_off_parks_even_a_fully_mapped_day():
    run = _Run(settings=None)
    assert await run() == "pending_review"
    payload = run.last["review_payload"]
    assert payload["flags"] == []
    assert (payload["setting_code"], payload["post_type"]) == ("Comanche.PMS", "REVENUE")
    assert payload["counter"] == {"dept": "GEN", "acc": "1021001", "name": "A/R - Guest Ledger"}
    assert payload["key_columns"] == ["Code", "Description"]
    assert len(payload["rows"]) == 4 and len(payload["mapped"]) == 4
    assert payload["databank_id"] == 148
    run.m["post"].assert_not_awaited()


@pytest.mark.asyncio
async def test_a_fully_mapped_day_of_an_auto_post_bu_goes_to_carmens_engine():
    run = _Run(settings=AUTO)
    assert await run() == "posted"
    assert run.last["status"] == "posted"
    assert run.last["review_payload"] is None
    assert (run.last["jv_no"], run.last["reason_code"]) == (None, None)
    post_type, body, token = run.m["post"].await_args.args
    assert post_type == "REVENUE" and token == "tok"
    assert body == {
        "Code": "Comanche.PMS",
        "DateFrom": "2025-10-20",
        "DateTo": "2025-10-20",
        "DeptCode": "GEN",
        "AccCode": "1021001",
        "id": [148],
    }


@pytest.mark.asyncio
async def test_a_day_carmen_has_already_posted_is_posted():
    run = _Run(settings=AUTO, post={"Code": -200, "UserMessage": "Already Posted."})
    assert await run() == "posted"
    assert run.last["reason_code"] == "already_posted"


@pytest.mark.asyncio
async def test_new_rows_are_suggested_from_the_bus_own_table_and_the_day_parks():
    partial = [r for r in FULL if r["Description"] != "Room Charge - VAT"]
    key = next(r["key"] for r in ROWS if r["values"]["Description"] == "Room Charge - VAT")
    pick = {key: {"dept": "GEN", "acc": "2012003", "confidence": "high", "why": "output tax"}}
    run = _Run(settings=AUTO, table=partial, suggest=pick)
    assert await run() == "pending_review"
    new, rows, table = run.m["suggest"].await_args.args[:3]
    assert new == [key] and rows == ROWS and len(table) == 3
    payload = run.last["review_payload"]
    assert payload["flags"] == ["mapping_guessed"] and payload["ai"] == [key]
    assert payload["guessed"] == pick
    run.m["post"].assert_not_awaited()


@pytest.mark.asyncio
async def test_a_row_the_ai_could_not_place_is_missing():
    run = _Run(table=FULL[:3])
    assert await run() == "pending_review"
    assert run.last["review_payload"]["flags"] == ["mapping_missing"]


@pytest.mark.asyncio
async def test_carmens_engine_refusing_parks_the_day_with_its_words():
    run = _Run(settings=AUTO, post={"Code": -500, "UserMessage": "Mapping is incomplete."})
    assert await run() == "pending_review"
    assert run.last["reason_code"] == "carmen_rejected"
    assert run.last["error_message"] == "Mapping is incomplete."


@pytest.mark.asyncio
async def test_no_credential_is_retried_then_fails():
    run = _Run(target=("", ""))
    assert await run() == "retry"
    assert run.last["reason_code"] == "no_credential"
    assert "PMS settings" in run.last["error_message"]
    last_try = _Run(target=("", ""), claimed=_claimed(attempts=process.MAX_ATTEMPTS))
    assert await last_try() == "failed"
    assert last_try.last["status"] == "failed"


@pytest.mark.asyncio
async def test_unreadable_carmen_config_is_its_own_reason():
    """The menu token cannot read the setting until Carmen opens it (CA-116)."""
    run = _Run(carmen_settings=CarmenAPIError(404, "HTTP 404: not found"))
    assert await run() == "retry"
    assert run.last["reason_code"] == "carmen_config_unreadable"
    run = _Run(table=CarmenAPIError(405, "HTTP 405: method"))
    assert await run() == "retry"
    assert run.last["reason_code"] == "carmen_config_unreadable"


@pytest.mark.asyncio
async def test_no_active_setting_for_the_interface():
    run = _Run(carmen_settings=[_setting(name="Opera")])
    assert await run() == "retry"
    assert run.last["reason_code"] == "pms_setting_missing"


@pytest.mark.asyncio
async def test_a_file_layout_the_reader_does_not_take_fails_without_guessing():
    run = _Run(carmen_settings=[_setting(ini=CUSTOM_INI)])
    assert await run() == "failed"
    assert run.last["reason_code"] == "unsupported_pms_format"
    run.m["databank"].assert_not_awaited()


@pytest.mark.asyncio
async def test_a_missing_permission_says_which_in_carmens_words():
    denied = CarmenAPIError(
        403,
        'HTTP 403: {"Code":403,"UserMessage":"Access Denied.","InternalMessage":"Permission Name = Inf.PMS.DataBank | Permission Action = View","MoreInfo":""}',
    )
    run = _Run(databank=denied)
    assert await run() == "retry"
    assert run.last["reason_code"] == "carmen_forbidden"
    assert run.last["error_message"] == (
        "Access Denied. Permission Name = Inf.PMS.DataBank | Permission Action = View"
    )


@pytest.mark.asyncio
async def test_a_dead_token_reads_as_unauthorized():
    run = _Run(databank=CarmenAPIError(401, "HTTP 401: denied"))
    assert await run() == "retry"
    assert run.last["reason_code"] == "carmen_unauthorized"


@pytest.mark.asyncio
async def test_a_day_the_data_bank_does_not_have_yet_is_retried():
    run = _Run(databank=[])
    assert await run() == "retry"
    assert run.last["reason_code"] == "day_not_found"


@pytest.mark.asyncio
async def test_an_unexpected_error_is_recorded_not_lost():
    run = _Run(table=RuntimeError("boom"))
    assert await run() == "retry"
    assert run.last == {"reason_code": "processing_error", "error_message": "boom"}


@pytest.mark.asyncio
async def test_a_day_someone_else_holds_is_skipped():
    with patch.object(process, "_claim", AsyncMock(return_value=None)):
        assert await process.process_event(uuid4()) == "skipped"


def test_carmens_words_come_out_of_its_error_body():
    exc = CarmenAPIError(
        403, 'HTTP 403: {"Code":403,"UserMessage":"Access Denied.","InternalMessage":null}'
    )
    assert process.carmen_words(exc) == "Access Denied."
    assert process.carmen_words(CarmenAPIError(503, "Unable to connect")) == "Unable to connect"


def _db_returning(ids):
    result = MagicMock(scalars=lambda: MagicMock(all=lambda: ids))
    db = MagicMock(execute=AsyncMock(return_value=result), commit=AsyncMock())

    @asynccontextmanager
    async def session():
        yield db

    return db, session


@pytest.mark.asyncio
async def test_a_credential_proven_after_the_last_attempt_wakes_the_day():
    """Any writer of the one credential wakes a day it stopped, not only PUT /pms/credential:
    the email settings store the same token, and the daily check re-proves it."""
    db, session = _db_returning([uuid4()])
    with patch.object(process, "async_session", session):
        assert await process._wake_for_new_credential() == 1
    sql = str(db.execute.call_args.args[0].compile(dialect=postgresql.dialect()))
    assert "FROM email_ingest_settings" in sql
    assert "email_ingest_settings.carmen_token_verified_at > pms_events.processed_at" in sql
    assert "pms_events.reason_code IN" in sql
    assert "carmen_config_unreadable" in process.WAKE_REASONS
    assert "carmen_forbidden" in process.WAKE_REASONS


@pytest.mark.asyncio
async def test_the_sweep_wakes_those_days_before_it_picks():
    pk = uuid4()
    _, session = _db_returning([pk])
    with (
        patch.object(process, "_requeue_ready_days", AsyncMock(return_value=0)),
        patch.object(process, "_wake_for_new_credential", AsyncMock(return_value=1)),
        patch.object(process, "async_session", session),
        patch.object(process, "process_event", AsyncMock(return_value="pending_review")) as one,
        patch.object(process, "_record_run", AsyncMock()),
    ):
        summary = await process.run_pms_processing()
    assert summary["woken"] == 1 and summary["pending_review"] == 1
    one.assert_awaited_once_with(pk)


@pytest.mark.asyncio
async def test_ready_days_of_an_auto_post_bu_are_sent_back_flagged_ones_stay():
    ready, flagged = uuid4(), uuid4()
    result = MagicMock(
        all=lambda: [(ready, {"flags": []}), (flagged, {"flags": ["mapping_guessed"]})]
    )
    db = MagicMock(execute=AsyncMock(return_value=result), commit=AsyncMock())

    @asynccontextmanager
    async def session():
        yield db

    with patch.object(process, "async_session", session):
        assert await process._requeue_ready_days() == 1
    sql = str(db.execute.await_args_list[1].args[0].compile(dialect=postgresql.dialect()))
    assert "UPDATE pms_events" in sql
