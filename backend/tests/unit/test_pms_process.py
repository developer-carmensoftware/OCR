"""CA-119 / decision-log #43 — processing one PMS day (services/pms/process.py).

The claim, the credential, Carmen and the writes are patched; what is pinned is the
decision: which days park, which go to Carmen's engine, and what a failure leaves on the
row. No side or total is computed anywhere here — those are the engine's.
"""

from contextlib import asynccontextmanager
from datetime import UTC, date, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy.dialects import postgresql

from app.services.pms import carmen_config as cfg
from app.services.pms import process
from app.services.shared.carmen import CarmenAPIError
from tests.unit.test_pms_carmen_config import COLUMNS, DAY, INTERFACES, TABLE_COLUMNS

HOOK = {
    "InterfaceType": "PMS",
    "InterfaceName": "Comanche",
    "DocType": "Daily",
    "DocDate": "2025-10-20",
}
DATABANK = [{"Id": 148, "LastModified": "2026-10-14T14:29:34+07:00", "FileData": DAY}]
ROWS = cfg.rows_of(DAY, "Transaction", COLUMNS)
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
# The engine's answer since ask D (2026-11-03): `Id` names the JV it made.
POSTED = {
    "Result": True,
    "RecordCount": 1,
    "Code": 1,
    "UserMessage": "Posting complete.",
    "Id": [1599],
}
AUTO = SimpleNamespace(auto_post=True)


def _claimed(attempts=1, created_at=None):
    return SimpleNamespace(
        id=uuid4(),
        tenant_id=uuid4(),
        payload=HOOK,
        attempts=attempts,
        created_at=created_at or datetime.now(UTC),
    )


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
        interfaces=INTERFACES,
        databank=DATABANK,
        table=FULL,
        columns=TABLE_COLUMNS,
        suggest=None,
        post=POSTED,
        claimed=None,
    ):
        self.claimed = claimed or _claimed()
        self.writes: list[dict] = []
        db = MagicMock(get=AsyncMock(return_value=settings))
        self.db = db

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
            "interfaces": patch.object(process.carmen, "get_interfaces", _mock(interfaces)),
            "databank": patch.object(process.carmen, "get_databank_day", _mock(databank)),
            "mapping": patch.object(
                process.carmen,
                "get_pms_mapping",
                _mock(table if isinstance(table, Exception) else (table, columns)),
            ),
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
    assert "counter" not in payload
    assert payload["key_columns"] == ["Code", "Description"]
    assert len(payload["rows"]) == 4 and len(payload["mapped"]) == 4
    assert payload["databank_id"] == 148
    run.m["post"].assert_not_awaited()


@pytest.mark.asyncio
async def test_a_fully_mapped_day_of_an_auto_post_bu_goes_to_carmens_engine():
    run = _Run(settings=AUTO)
    assert await run() == "posted"
    # Auto-post is the BU's for this PMS (decision-log #44), looked up by the hook's name.
    assert run.db.get.await_args.args[1] == (run.claimed.tenant_id, "comanche")
    assert run.last["status"] == "posted"
    assert run.last["review_payload"] is None
    # The JV's seq, from the answer's `Id`: what the queue's Open JV opens.
    assert (run.last["jv_no"], run.last["reason_code"]) == ("1599", None)
    post_type, body, token = run.m["post"].await_args.args
    assert post_type == "REVENUE" and token == "tok"
    assert body == {
        "Code": "Comanche.PMS",
        "DateFrom": "2025-10-20",
        "DateTo": "2025-10-20",
        "id": [148],
    }


@pytest.mark.asyncio
async def test_a_day_carmen_has_already_posted_is_posted():
    run = _Run(settings=AUTO, post={"Code": -200, "UserMessage": "Already Posted."})
    assert await run() == "posted"
    assert (run.last["reason_code"], run.last["jv_no"]) == ("already_posted", None)


@pytest.mark.asyncio
async def test_an_answer_without_an_id_posts_without_a_jv_link():
    """Carmen's answer before ask D: the day posts all the same, with no JV to link."""
    run = _Run(settings=AUTO, post={k: v for k, v in POSTED.items() if k != "Id"})
    assert await run() == "posted"
    assert (run.last["status"], run.last["jv_no"]) == ("posted", None)
    run = _Run(settings=AUTO, post={**POSTED, "Id": []})
    assert await run() == "posted"
    assert run.last["jv_no"] is None


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
    refused = {
        "Result": False,
        "Code": -1,
        "UserMessage": "Error",
        "ErrorList": [{"Date": "06/10/2026", "Message": "Invalid account codes 1115001"}],
    }
    run = _Run(settings=AUTO, post=refused)
    assert await run() == "pending_review"
    assert run.last["reason_code"] == "carmen_rejected"
    assert "Invalid account codes 1115001" in run.last["error_message"]


@pytest.mark.asyncio
async def test_carmen_finding_a_key_unmapped_parks_the_day_as_mapping_incomplete():
    """The engine checks the mapping itself and posts nothing (decision-log #52)."""
    run = _Run(settings=AUTO, post={"Code": -500, "UserMessage": "Mapping is incomplete."})
    assert await run() == "pending_review"
    assert run.last["reason_code"] == "pms_mapping_incomplete"
    assert run.last["error_message"] == "Mapping is incomplete."


@pytest.mark.asyncio
async def test_no_credential_is_retried_then_fails():
    run = _Run(target=("", ""))
    assert await run() == "retry"
    assert run.last["reason_code"] == "no_credential"
    assert "PMS's setting in Carmen" in run.last["error_message"]
    last_try = _Run(target=("", ""), claimed=_claimed(attempts=process.MAX_ATTEMPTS))
    assert await last_try() == "failed"
    assert last_try.last["status"] == "failed"


@pytest.mark.asyncio
async def test_unreadable_carmen_config_is_its_own_reason():
    """The interface list or the mapping table could not be read, or keys nothing."""
    run = _Run(interfaces=CarmenAPIError(404, "HTTP 404: not found"))
    assert await run() == "retry"
    assert run.last["reason_code"] == "carmen_config_unreadable"
    run = _Run(table=CarmenAPIError(303, 'HTTP 303: {"UserMessage":"Configuration is missing"}'))
    assert await run() == "retry"
    assert run.last["reason_code"] == "carmen_config_unreadable"
    run = _Run(columns=["DeptCode", "AccCode", "AccDesc"])
    assert await run() == "retry"
    assert run.last["reason_code"] == "carmen_config_unreadable"
    run.m["databank"].assert_not_awaited()


@pytest.mark.asyncio
async def test_no_revenue_section_for_the_interface():
    run = _Run(interfaces=[{**INTERFACES[0], "InterfaceName": "Opera"}, INTERFACES[1]])
    assert await run() == "retry"
    assert run.last["reason_code"] == "pms_setting_missing"
    run.m["mapping"].assert_not_awaited()


# HotelTime's layout (dev Data Bank, 2026-10-06): its rows are `Revenue`, and its mapping
# table keys them `HT_Code` / `HT_Description` / `Department` — names the day does not use.
HOTELTIME = [
    {
        "Id": 171,
        "LastModified": "2026-10-07T03:32:57+07:00",
        "FileData": {
            "Revenue": [
                {"Code": "4100001", "Description": "001 - Room Charge (Auto)", "Amount": 42748.69}
            ]
        },
    }
]
HT_COLUMNS = ["HT_Code", "HT_Description", "Department", "DeptCode", "AccCode", "AccDesc"]


@pytest.mark.asyncio
async def test_a_day_the_reader_cannot_key_waits_for_approve_with_no_rows():
    """No preview is not a failure (decision-log #52): with auto-post off the day parks, and
    Carmen checks the mapping when it is approved."""
    run = _Run(databank=HOTELTIME, table=[], columns=HT_COLUMNS)
    assert await run() == "pending_review"
    payload = run.last["review_payload"]
    assert payload["preview"] is False
    assert (payload["rows"], payload["flags"], payload["databank_id"]) == ([], [], 171)
    assert payload["key_columns"] == ["HT_Code", "HT_Description", "Department"]
    assert run.last["reason_code"] is None
    run.m["suggest"].assert_not_awaited()
    run.m["post"].assert_not_awaited()


@pytest.mark.asyncio
async def test_a_day_the_reader_cannot_key_goes_to_carmen_when_auto_post_is_on():
    run = _Run(settings=AUTO, databank=HOTELTIME, table=[], columns=HT_COLUMNS)
    assert await run() == "posted"
    assert run.m["post"].await_args.args[1]["id"] == [171]
    run = _Run(
        settings=AUTO,
        databank=HOTELTIME,
        table=[],
        columns=HT_COLUMNS,
        post={"Code": -500, "UserMessage": "Mapping is incomplete."},
    )
    assert await run() == "pending_review"
    assert run.last["reason_code"] == "pms_mapping_incomplete"
    assert run.last["review_payload"]["preview"] is False


@pytest.mark.asyncio
async def test_a_file_that_is_not_json_is_not_a_failure_either():
    """GuestLine's day is CSV: nothing here can key it, so Carmen does (decision-log #52)."""
    csv = [{"Id": 180, "LastModified": "2026-10-06", "FileData": "Code,Description\n100,Room"}]
    run = _Run(interfaces=[{**INTERFACES[0], "PostType": "Csv"}], databank=csv)
    assert await run() == "pending_review"
    assert run.last["review_payload"]["preview"] is False
    assert run.last["review_payload"]["databank_id"] == 180


@pytest.mark.asyncio
async def test_a_readable_day_keeps_its_preview():
    run = _Run()
    assert await run() == "pending_review"
    assert run.last["review_payload"]["preview"] is True


@pytest.mark.asyncio
async def test_a_day_the_sweep_opened_posts_by_date_alone_when_the_data_bank_has_none():
    """A PartnerApi PMS: Carmen fetches the day when it posts, so no Data Bank row, no id."""
    opened = _claimed()
    opened.payload = {**HOOK, "Source": process.OPENED_BY_SWEEP}
    run = _Run(settings=AUTO, databank=[], claimed=opened)
    assert await run() == "posted"
    body = run.m["post"].await_args.args[1]
    assert body == {"Code": "Comanche.PMS", "DateFrom": "2025-10-20", "DateTo": "2025-10-20"}
    off = _claimed()
    off.payload = {**HOOK, "Source": process.OPENED_BY_SWEEP}
    run = _Run(databank=[], claimed=off)
    assert await run() == "pending_review"
    assert run.last["review_payload"]["databank_id"] is None


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
        patch.object(process, "_open_partner_days", AsyncMock(return_value=2)) as opener,
        patch.object(process, "_requeue_ready_days", AsyncMock(return_value=0)),
        patch.object(process, "_wake_for_new_credential", AsyncMock(return_value=1)),
        patch.object(process, "async_session", session),
        patch.object(process, "process_event", AsyncMock(return_value="pending_review")) as one,
        patch.object(process, "_record_run", AsyncMock()),
    ):
        summary = await process.run_pms_processing()
    assert summary["woken"] == 1 and summary["pending_review"] == 1
    # PartnerApi days are opened first, so the same sweep works through them.
    opener.assert_awaited_once()
    assert summary["opened"] == 2
    one.assert_awaited_once_with(pk)


@pytest.mark.asyncio
async def test_ready_days_of_an_auto_post_pms_are_sent_back_others_stay():
    bu = uuid4()
    ready, flagged, other_pms = uuid4(), uuid4(), uuid4()
    on = MagicMock(all=lambda: [(bu, "comanche")])  # auto-post is on for Comanche only
    parked = MagicMock(
        all=lambda: [
            (ready, bu, {"InterfaceName": "Comanche"}, {"flags": []}),
            (flagged, bu, {"InterfaceName": "Comanche"}, {"flags": ["mapping_guessed"]}),
            (other_pms, bu, {"InterfaceName": "Opera"}, {"flags": []}),
        ]
    )
    db = MagicMock(execute=AsyncMock(side_effect=[on, parked, MagicMock()]), commit=AsyncMock())

    @asynccontextmanager
    async def session():
        yield db

    with patch.object(process, "async_session", session):
        assert await process._requeue_ready_days() == 1
    update_stmt = db.execute.await_args_list[2].args[0]
    sql = str(update_stmt.compile(dialect=postgresql.dialect()))
    assert "UPDATE pms_events" in sql
    assert update_stmt.compile().params["id_1"] == [ready]


# ── PartnerApi days: opened by the sweep (decision-log #52) ────────────────────────


@asynccontextmanager
async def _no_db():
    yield MagicMock()


PARTNER_LIST = [{**INTERFACES[0], "InterfaceName": "HotelTime", "From": "PartnerApi"}, *INTERFACES]


@pytest.mark.asyncio
async def test_no_day_opens_before_the_hotels_day_is_closed():
    with patch.object(process, "async_session") as session:
        at_7_59 = datetime(2026, 11, 6, 0, 59, tzinfo=UTC)  # 07:59 ICT
        assert await process._open_partner_days(at_7_59) == 0
    session.assert_not_called()


@pytest.mark.asyncio
async def test_yesterday_opens_for_each_partner_pms_a_bu_switched_on():
    bu, other = uuid4(), uuid4()
    live = MagicMock(all=lambda: [(bu, "hoteltime"), (bu, "comanche"), (other, "guestline")])
    db = MagicMock(
        execute=AsyncMock(return_value=live),
        scalar=AsyncMock(return_value=None),
        commit=AsyncMock(),
    )

    @asynccontextmanager
    async def session():
        yield db

    # Comanche is a hooked PMS (not on the list); the other BU's list could not be read.
    names = {bu: {"hoteltime": "HotelTime"}, other: None}
    stored = AsyncMock(return_value=uuid4())
    with (
        patch.object(process, "async_session", session),
        patch.object(process, "_partner_names", AsyncMock(side_effect=lambda t, d: names[t])),
        patch.object(process, "store_day", stored),
    ):
        at_nine = datetime(2026, 11, 6, 2, 0, tzinfo=UTC)  # 09:00 ICT
        assert await process._open_partner_days(at_nine) == 1
    tenant, event_id, type_, payload = stored.await_args.args[1:]
    assert (tenant, event_id, type_) == (bu, "PMS/HotelTime/Daily/2026-11-05", "PMS")
    assert payload == {
        "InterfaceType": "PMS",
        "InterfaceName": "HotelTime",
        "DocType": "Daily",
        "DocDate": "2026-11-05",
        "Source": process.OPENED_BY_SWEEP,
    }
    # A day already stored (a hook came first, or an earlier sweep) is not opened twice.
    with (
        patch.object(process, "async_session", session),
        patch.object(process, "_partner_names", AsyncMock(side_effect=lambda t, d: names[t])),
        patch.object(process, "store_day", AsyncMock(return_value=None)),
    ):
        assert await process._open_partner_days(at_nine) == 0


@pytest.mark.asyncio
async def test_carmens_list_is_read_once_a_day_and_a_failure_is_asked_again():
    process._partner_cache.clear()
    bu = uuid4()
    lists = AsyncMock(
        side_effect=[CarmenAPIError(500, "HTTP 500: IsNullOrWhiteSpace"), PARTNER_LIST]
    )
    target = AsyncMock(return_value=("tok", "https://dev.carmen4.com"))
    today = date(2026, 11, 6)
    try:
        with (
            patch.object(process, "async_session", _no_db),
            patch.object(process, "_target", target),
            patch.object(process.carmen, "get_interfaces", lists),
        ):
            assert await process._partner_names(bu, today) is None
            assert await process._partner_names(bu, today) == {"hoteltime": "HotelTime"}
            assert await process._partner_names(bu, today) == {"hoteltime": "HotelTime"}
        assert lists.await_count == 2
        with (
            patch.object(process, "async_session", _no_db),
            patch.object(process, "_target", AsyncMock(return_value=("", ""))),
        ):
            assert await process._partner_names(uuid4(), today) is None
    finally:
        process._partner_cache.clear()


# Carmen's answer for a date it has no data for (dev, 2026-11-06). -400 alone is not it:
# "Configuration is missing" is -400 too.
NO_DATA = {"Code": -400, "UserMessage": "No Data Found on 05/11/2026 to 05/11/2026 "}


@pytest.mark.asyncio
async def test_a_day_carmen_has_no_data_for_yet_is_asked_again_hourly_without_spending_tries():
    opened = _claimed(attempts=2)
    opened.payload = {**HOOK, "Source": process.OPENED_BY_SWEEP}
    run = _Run(settings=AUTO, databank=[], claimed=opened, post=NO_DATA)
    assert await run() == "retry"
    assert run.last["reason_code"] == "day_not_ready"
    assert run.last["error_message"] == "No Data Found on 05/11/2026 to 05/11/2026"
    assert run.last["attempts"] == 1  # the claim's +1 is given back
    assert "status" not in run.last  # still `received`, for the next hourly try


@pytest.mark.asyncio
async def test_a_day_still_without_data_after_a_day_is_given_up():
    from datetime import timedelta

    stale = _claimed(created_at=datetime.now(UTC) - timedelta(hours=25))
    stale.payload = {**HOOK, "Source": process.OPENED_BY_SWEEP}
    run = _Run(settings=AUTO, databank=[], claimed=stale, post=NO_DATA)
    assert await run() == "failed"
    assert (run.last["status"], run.last["reason_code"]) == ("failed", "day_not_found")


@pytest.mark.asyncio
async def test_a_missing_configuration_is_not_mistaken_for_no_data():
    missing = {"Code": -400, "UserMessage": "Configuration is missing"}
    run = _Run(settings=AUTO, post=missing)
    assert await run() == "pending_review"
    assert run.last["reason_code"] == "carmen_rejected"


def test_a_day_without_data_yet_is_not_taken_again_within_the_hour():
    sql = str(process._due(datetime.now(UTC)).compile(dialect=postgresql.dialect()))
    assert "reason_code IS DISTINCT FROM" in sql and "processed_at <" in sql


@pytest.mark.asyncio
async def test_a_day_a_hook_stored_in_another_casing_is_not_opened_again():
    """Carmen's list says `Hoteltime`, the hook said `HotelTime`: still one row per day."""
    bu = uuid4()
    live = MagicMock(all=lambda: [(bu, "hoteltime")])
    db = MagicMock(
        execute=AsyncMock(return_value=live),
        scalar=AsyncMock(return_value=uuid4()),
        commit=AsyncMock(),
    )

    @asynccontextmanager
    async def session():
        yield db

    stored = AsyncMock(return_value=uuid4())
    with (
        patch.object(process, "async_session", session),
        patch.object(process, "_partner_names", AsyncMock(return_value={"hoteltime": "Hoteltime"})),
        patch.object(process, "store_day", stored),
    ):
        assert await process._open_partner_days(datetime(2026, 11, 6, 2, 0, tzinfo=UTC)) == 0
    stored.assert_not_awaited()
    held = str(db.scalar.await_args.args[0].compile(dialect=postgresql.dialect()))
    assert "lower(pms_events.event_id)" in held
