"""CA-119 — processing one PMS day (services/pms/process.py).

The claim, the credential, Carmen and the writes are patched; what is pinned is the
decision: which days park, which post, and what a failure leaves on the row.
"""

from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.services.pms import posting, process
from app.services.shared.carmen import CarmenAPIError
from tests.unit.test_pms_day import FILE_DATA, RULES

HOOK = {
    "InterfaceType": "PMS",
    "InterfaceName": "Comanche",
    "DocType": "Daily",
    "DocDate": "2024-09-05",
}
DATABANK = [{"Id": 134, "LastModified": "2024-09-05T23:01:26", "FileData": FILE_DATA}]


def _claimed(attempts=1):
    return SimpleNamespace(id=uuid4(), tenant_id=uuid4(), payload=HOOK, attempts=attempts)


class _Run:
    """One `process_event` call with everything around the decision patched."""

    def __init__(
        self,
        *,
        settings=None,
        rules=RULES,
        target=("tok", "https://dev.carmen4.com"),
        databank=DATABANK,
        suggest=None,
        post="JV2409-0001",
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

        self.patches = [
            patch.object(process, "_claim", AsyncMock(return_value=self.claimed)),
            patch.object(process, "async_session", session),
            patch.object(process, "_target", AsyncMock(return_value=target)),
            patch.object(process, "_write", write),
            patch.object(process.mapping, "saved", AsyncMock(return_value=rules)),
            patch.object(process.mapping, "masters", AsyncMock(return_value=([], []))),
            patch.object(process.mapping, "suggest", AsyncMock(return_value=suggest or {})),
            patch.object(
                process.carmen,
                "get_databank_day",
                AsyncMock(side_effect=databank)
                if isinstance(databank, Exception)
                else AsyncMock(return_value=databank),
            ),
            patch.object(
                process.posting,
                "post_day",
                AsyncMock(side_effect=post)
                if isinstance(post, Exception)
                else AsyncMock(return_value=post),
            ),
        ]

    async def __call__(self):
        mocks = [p.start() for p in self.patches]
        try:
            outcome = await process.process_event(self.claimed.id)
        finally:
            for p in self.patches:
                p.stop()
        self.suggest, self.post = mocks[6], mocks[8]
        return outcome

    @property
    def last(self) -> dict:
        return self.writes[-1]


AUTO = SimpleNamespace(auto_post=True, jv_prefix="JV")


@pytest.mark.asyncio
async def test_auto_post_off_parks_even_a_clean_day():
    run = _Run(settings=None)
    assert await run() == "pending_review"
    assert run.last["status"] == "pending_review"
    payload = run.last["review_payload"]
    assert payload["flags"] == []
    assert payload["doc_date"] == "2024-09-05"
    assert len(payload["rows"]) == 6
    run.post.assert_not_awaited()


@pytest.mark.asyncio
async def test_a_clean_day_of_an_auto_post_bu_posts():
    run = _Run(settings=AUTO)
    assert await run() == "posted"
    assert run.last["status"] == "posted"
    assert run.last["jv_no"] == "JV2409-0001"
    assert run.last["review_payload"] is None
    body = run.post.await_args.args[0]
    assert body["Prefix"] == "JV"
    assert body["Description"] == "Comanche Daily 05/09/2024"
    assert sum(d["CrAmount"] for d in body["Detail"]) == sum(d["DrAmount"] for d in body["Detail"])


@pytest.mark.asyncio
async def test_a_new_code_is_suggested_and_the_day_parks_even_with_auto_post():
    rules = {k: v for k, v in RULES.items() if k != "Revenue|729"}
    pick = {
        "Revenue|729": {"dept": "304", "acc": "4240011", "confidence": "medium", "why": "rebate"}
    }
    run = _Run(settings=AUTO, rules=rules, suggest=pick)
    assert await run() == "pending_review"
    assert run.suggest.await_args.args[0] == ["Revenue|729"]
    assert run.last["review_payload"]["flags"] == ["mapping_guessed"]
    assert run.last["review_payload"]["guessed"] == pick
    run.post.assert_not_awaited()


@pytest.mark.asyncio
async def test_no_prefix_means_nothing_posts():
    run = _Run(settings=SimpleNamespace(auto_post=True, jv_prefix=None))
    assert await run() == "pending_review"
    run.post.assert_not_awaited()


@pytest.mark.asyncio
async def test_carmen_refusing_the_jv_parks_the_day_with_its_words():
    run = _Run(settings=AUTO, post=posting.PostRefused("Period is closed"))
    assert await run() == "pending_review"
    assert run.last["reason_code"] == "carmen_rejected"
    assert run.last["error_message"] == "Period is closed"


@pytest.mark.asyncio
async def test_no_credential_is_retried_then_fails():
    run = _Run(target=("", ""))
    assert await run() == "retry"
    assert run.last == {
        "reason_code": "no_credential",
        "error_message": run.last["error_message"],
    }
    assert "PMS settings" in run.last["error_message"]

    last_try = _Run(target=("", ""), claimed=_claimed(attempts=process.MAX_ATTEMPTS))
    assert await last_try() == "failed"
    assert last_try.last["status"] == "failed"


@pytest.mark.asyncio
async def test_a_day_the_data_bank_does_not_have_yet_is_retried():
    run = _Run(databank=[])
    assert await run() == "retry"
    assert run.last["reason_code"] == "day_not_found"


@pytest.mark.asyncio
async def test_a_dead_token_reads_as_unauthorized():
    run = _Run(databank=CarmenAPIError(401, "HTTP 401: denied"))
    assert await run() == "retry"
    assert run.last["reason_code"] == "carmen_unauthorized"


@pytest.mark.asyncio
async def test_an_unexpected_error_is_recorded_not_lost():
    run = _Run()
    run.patches[4] = patch.object(
        process.mapping, "saved", AsyncMock(side_effect=RuntimeError("boom"))
    )
    assert await run() == "retry"
    assert run.last == {"reason_code": "processing_error", "error_message": "boom"}


@pytest.mark.asyncio
async def test_a_day_someone_else_holds_is_skipped():
    with patch.object(process, "_claim", AsyncMock(return_value=None)):
        assert await process.process_event(uuid4()) == "skipped"


def test_the_newest_readable_data_bank_row_wins():
    old = {"Id": 1, "LastModified": "2024-09-05T23:00:00", "FileData": FILE_DATA}
    new = {"Id": 2, "LastModified": "2024-09-06T01:00:00", "FileData": FILE_DATA}
    junk = {"Id": 3, "LastModified": "2024-09-07T00:00:00", "FileData": "not json"}
    assert process._newest_day([old, new, junk])["Id"] == 2
    assert process._newest_day([junk]) is None
