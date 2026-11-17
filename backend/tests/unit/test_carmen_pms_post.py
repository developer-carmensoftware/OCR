"""Decision-log #60 — Carmen's review mode: a post we mean says `forceUpdate=true`.

Carmen (2026-11-17) gave each GL interface a status. In review mode `interfacePostGL` answers
`Code -1 "Posting to GL '<code>' is in review mode."` with `infData` and posts nothing, unless
the call says `forceUpdate=true`. We call the post only to post (Approve, auto-post), so every
post says so. The preview never posts and says nothing of it.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.shared import carmen

SVC = "app.services.shared.carmen"


def _client(answer: dict) -> AsyncMock:
    resp = MagicMock(status_code=200, content=b"{}")
    resp.json.return_value = answer
    client = AsyncMock()
    client.post.return_value = resp
    return client


def _patched(client):
    return (
        patch(f"{SVC}.get_http_client", return_value=client),
        patch(f"{SVC}._base_url", return_value="http://carmen/api/interface"),
        patch(f"{SVC}._headers", return_value={"Authorization": "tok"}),
    )


@pytest.mark.asyncio
async def test_a_post_always_says_force_update_true():
    client = _client({"Result": True, "Id": [1650]})
    a, b, c = _patched(client)
    with a, b, c:
        answer = await carmen.post_pms_gl("REVENUE", {"Code": "Comanche.PMS"}, "tok")
    assert answer["Id"] == [1650]
    args, kwargs = client.post.await_args
    assert args[0] == "http://carmen/api/interface/interfacePostGL/REVENUE"
    assert kwargs["params"] == {"forceUpdate": "true"}
    assert kwargs["json"] == {"Code": "Comanche.PMS"}


@pytest.mark.asyncio
async def test_the_preview_never_asks_to_force_a_post():
    client = _client({"TableName": "Mapping"})
    a, b, c = _patched(client)
    with a, b, c:
        await carmen.preview_pms_gl("REVENUE", {"Code": "Comanche.PMS"}, "tok")
    assert "forceUpdate" not in (client.post.await_args.kwargs.get("params") or {})
