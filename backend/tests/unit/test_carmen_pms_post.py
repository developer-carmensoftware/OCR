"""Decision-log #62 (amending #60) — how a post we mean talks to Carmen's review mode.

`forceUpdate=true` is Carmen's "post it again": on a day it already posted, Carmen voids that JV
and posts a new one (seen 2026-11-17: JV 1684 voided by 1685). So the post says `false` first,
which keeps Carmen's `Code -200 "Already Posted."`, and says `true` only after Carmen answers
`Code -1 "… is in review mode."` (an interface Carmen holds for review: no JV, no check). The
preview never posts and says nothing of it.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.shared import carmen

SVC = "app.services.shared.carmen"
REVIEW = {
    "Result": False,
    "Code": -1,
    "UserMessage": "Posting to GL 'Comanche.PMS' is in review mode.",
    "infData": [],
}
POSTED = {"Result": True, "Code": 1, "Id": [1650], "UserMessage": "Posting complete."}
ALREADY = {"Code": -200, "UserMessage": "Already Posted."}


def _client(*answers: dict) -> AsyncMock:
    resps = []
    for a in answers:
        resp = MagicMock(status_code=200, content=b"{}")
        resp.json.return_value = a
        resps.append(resp)
    client = AsyncMock()
    client.post.side_effect = resps
    return client


def _patched(client):
    return (
        patch(f"{SVC}.get_http_client", return_value=client),
        patch(f"{SVC}._base_url", return_value="http://carmen/api/interface"),
        patch(f"{SVC}._headers", return_value={"Authorization": "tok"}),
    )


async def _post(client):
    a, b, c = _patched(client)
    with a, b, c:
        return await carmen.post_pms_gl("REVENUE", {"Code": "Comanche.PMS"}, "tok")


def _forces(client) -> list[str]:
    return [call.kwargs["params"]["forceUpdate"] for call in client.post.await_args_list]


@pytest.mark.asyncio
async def test_a_post_says_force_update_false_first():
    client = _client(POSTED)
    assert (await _post(client))["Id"] == [1650]
    args, kwargs = client.post.await_args
    assert args[0] == "http://carmen/api/interface/interfacePostGL/REVENUE"
    assert kwargs["json"] == {"Code": "Comanche.PMS"}
    assert _forces(client) == ["false"]


@pytest.mark.asyncio
async def test_a_day_carmen_already_posted_is_never_posted_again():
    client = _client(ALREADY)
    assert (await _post(client))["Code"] == -200
    assert _forces(client) == ["false"]


@pytest.mark.asyncio
async def test_a_review_mode_answer_is_posted_again_with_force_update_true():
    client = _client(REVIEW, POSTED)
    assert (await _post(client))["Id"] == [1650]
    assert _forces(client) == ["false", "true"]


@pytest.mark.asyncio
async def test_another_minus_one_is_not_forced():
    client = _client({"Result": False, "Code": -1, "UserMessage": "Period is closed."})
    assert (await _post(client))["Code"] == -1
    assert _forces(client) == ["false"]


@pytest.mark.asyncio
async def test_the_preview_never_asks_to_force_a_post():
    client = _client({"TableName": "Mapping"})
    a, b, c = _patched(client)
    with a, b, c:
        await carmen.preview_pms_gl("REVENUE", {"Code": "Comanche.PMS"}, "tok")
    assert "forceUpdate" not in (client.post.await_args.kwargs.get("params") or {})
