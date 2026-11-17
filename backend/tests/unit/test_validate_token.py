"""`validate_token` — what `/auth/exchange` answers for each way Carmen's check can go."""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi import HTTPException

from app.routers.auth import validate_token

URI = "https://dev.carmen4.com"


def _carmen(*, answer=None, raises=None):
    client = MagicMock()
    client.get = AsyncMock(side_effect=raises) if raises else AsyncMock(return_value=answer)
    return patch("app.services.shared.carmen.get_http_client", return_value=client)


@pytest.mark.asyncio
async def test_a_token_carmen_accepts_passes():
    with _carmen(answer=MagicMock(status_code=200)):
        assert await validate_token("tok", URI) is None


@pytest.mark.asyncio
async def test_a_token_carmen_rejects_is_401():
    with _carmen(answer=MagicMock(status_code=401)), pytest.raises(HTTPException) as e:
        await validate_token("tok", URI)
    assert e.value.status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize("exc", [httpx.ReadTimeout("slow"), httpx.ConnectError("down")])
async def test_a_carmen_that_does_not_answer_is_502_not_500(exc):
    with _carmen(raises=exc), pytest.raises(HTTPException) as e:
        await validate_token("tok", URI)
    assert e.value.status_code == 502
