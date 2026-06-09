"""
Unit tests for llm/client.py
Mocks AsyncOpenAI — no real API calls made.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _single_key_pool(mock_client):
    """Build a one-key capacity pool whose only key wraps the given mock client.

    Used to redirect call_vision_llm / call_text_llm (which now route through the
    per-key pool instead of get_client()) onto the test's mock.
    """
    from app.llm.client import _KeyState

    return [
        _KeyState(
            label="key1",
            client=mock_client,
            vision_sem=asyncio.Semaphore(6),
            text_sem=asyncio.Semaphore(6),
            vision_limit=6,
            text_limit=6,
        )
    ]


def _make_response(content, prompt_tokens=10, completion_tokens=5):
    """Build a minimal mock OpenAI response object."""
    choice = MagicMock()
    choice.message.content = content

    usage = MagicMock()
    usage.prompt_tokens = prompt_tokens
    usage.completion_tokens = completion_tokens
    usage.total_tokens = prompt_tokens + completion_tokens

    resp = MagicMock()
    resp.choices = [choice]
    resp.usage = usage
    return resp


# ── _strip_code_fences ────────────────────────────────────────────────────────


class TestStripCodeFences:
    def test_plain_json_unchanged(self):
        from app.llm.client import _strip_code_fences

        text = '{"key": "value"}'
        assert _strip_code_fences(text) == text

    def test_json_fence_stripped(self):
        from app.llm.client import _strip_code_fences

        text = '```json\n{"key": "value"}\n```'
        result = _strip_code_fences(text)
        assert result == '{"key": "value"}'

    def test_generic_fence_stripped(self):
        from app.llm.client import _strip_code_fences

        text = '```\n{"a": 1}\n```'
        result = _strip_code_fences(text)
        assert result == '{"a": 1}'

    def test_fence_without_closing_handled(self):
        from app.llm.client import _strip_code_fences

        text = '```json\n{"x": 1}'
        result = _strip_code_fences(text)
        # Should not crash; inner content extracted
        assert "{" in result


# ── B5: call_text_llm ─────────────────────────────────────────────────────────


class TestCallTextLlm:
    @pytest.fixture(autouse=True)
    def patch_deps(self):
        self.mock_client = AsyncMock()
        with (
            patch(
                "app.llm.client._get_pool",
                return_value=_single_key_pool(self.mock_client),
            ),
            patch("app.services.usage_service.log_llm_usage", new_callable=AsyncMock),
            patch("app.services.outbound_log_service.log_outbound", new_callable=AsyncMock),
        ):
            yield

    async def test_B5_1_valid_json_parsed(self):
        from app.llm.client import call_text_llm

        self.mock_client.chat.completions.create.return_value = _make_response('{"result": 42}')

        result = await call_text_llm("test prompt")

        assert result == {"result": 42}

    async def test_B5_2_json_with_markdown_fence_parsed(self):
        from app.llm.client import call_text_llm

        self.mock_client.chat.completions.create.return_value = _make_response(
            '```json\n{"dept": "ACC", "acc": "1100"}\n```'
        )

        result = await call_text_llm("test prompt")

        assert result == {"dept": "ACC", "acc": "1100"}

    async def test_B5_3_api_error_returns_none(self):
        # call_text_llm swallows API errors and returns None (soft failure for suggestions)
        from app.llm.client import call_text_llm

        self.mock_client.chat.completions.create.side_effect = Exception("network error")

        result = await call_text_llm("test prompt")
        assert result is None

    async def test_B5_4_invalid_json_returns_none(self):
        from app.llm.client import call_text_llm

        self.mock_client.chat.completions.create.return_value = _make_response(
            "This is not JSON at all"
        )

        result = await call_text_llm("test prompt")

        assert result is None

    async def test_empty_content_returns_none(self):
        from app.llm.client import call_text_llm

        self.mock_client.chat.completions.create.return_value = _make_response(None)

        result = await call_text_llm("test prompt")

        assert result is None

    async def test_uses_default_suggestion_model_when_none_passed(self):
        from app.config import settings
        from app.llm.client import call_text_llm

        self.mock_client.chat.completions.create.return_value = _make_response("{}")

        await call_text_llm("test prompt", model=None)

        call_args = self.mock_client.chat.completions.create.call_args
        assert call_args.kwargs["model"] == settings.openrouter_suggestion_model


# ── B5: call_vision_llm ───────────────────────────────────────────────────────


class TestCallVisionLlm:
    @pytest.fixture(autouse=True)
    def patch_deps(self):
        self.mock_client = AsyncMock()
        with (
            patch(
                "app.llm.client._get_pool",
                return_value=_single_key_pool(self.mock_client),
            ),
            patch("app.services.usage_service.log_llm_usage", new_callable=AsyncMock),
            patch("app.services.outbound_log_service.log_outbound", new_callable=AsyncMock),
        ):
            yield

    async def test_B5_5_api_error_raises_runtime_error(self):
        from app.llm.client import call_vision_llm

        self.mock_client.chat.completions.create.side_effect = Exception("timeout")

        with pytest.raises(RuntimeError, match="LLM API call failed"):
            await call_vision_llm(
                system_prompt="sys",
                user_content=[{"type": "text", "text": "hi"}],
                model="test-model",
            )

    async def test_B5_6_empty_content_raises_runtime_error(self):
        from app.llm.client import call_vision_llm

        self.mock_client.chat.completions.create.return_value = _make_response(None)

        with pytest.raises(RuntimeError, match="empty content"):
            await call_vision_llm(
                system_prompt="sys",
                user_content=[{"type": "text", "text": "hi"}],
                model="test-model",
            )

    async def test_success_returns_stripped_content(self):
        from app.llm.client import call_vision_llm

        self.mock_client.chat.completions.create.return_value = _make_response("  hello  ")

        result = await call_vision_llm(
            system_prompt="sys", user_content=[{"type": "text", "text": "hi"}], model="test-model"
        )

        assert result == "hello"

    async def test_log_llm_usage_called_when_usage_present(self):
        from app.llm.client import call_vision_llm

        self.mock_client.chat.completions.create.return_value = _make_response("ok")

        with patch("app.services.usage_service.log_llm_usage", new_callable=AsyncMock) as mock_log:
            with patch("app.services.outbound_log_service.log_outbound", new_callable=AsyncMock):
                await call_vision_llm(
                    system_prompt="sys",
                    user_content=[],
                    model="test-model",
                    task_id="task-1",
                    module_id="credit_card_ocr",
                )
            mock_log.assert_called_once()
            kwargs = mock_log.call_args.kwargs
            assert kwargs["module_id"] == "credit_card_ocr"


# ── Capacity pool: acquire / distribution / failover ──────────────────────────


def _multi_key_pool(n, vision_limit=5, text_limit=5, clients=None):
    from app.llm.client import _KeyState

    pool = []
    for i in range(1, n + 1):
        pool.append(
            _KeyState(
                label=f"key{i}",
                client=(clients[i - 1] if clients else AsyncMock()),
                vision_sem=asyncio.Semaphore(vision_limit),
                text_sem=asyncio.Semaphore(text_limit),
                vision_limit=vision_limit,
                text_limit=text_limit,
            )
        )
    return pool


def _rate_limit_error():
    import httpx
    from openai import RateLimitError

    req = httpx.Request("POST", "http://x")
    return RateLimitError("throttled", response=httpx.Response(429, request=req), body=None)


class TestCapacityPool:
    async def test_acquire_raises_capacity_error_when_saturated(self):
        from app.exceptions import LLMCapacityError
        from app.llm import client

        pool = _multi_key_pool(1, vision_limit=1)
        with (
            patch.object(client, "_get_pool", return_value=pool),
            patch.object(client.settings, "llm_max_queue_wait_seconds", 0.2),
        ):
            held = await client._acquire("vision")  # take the only slot
            try:
                with pytest.raises(LLMCapacityError):
                    await client._acquire("vision")
            finally:
                client._release(held, "vision")

    async def test_acquire_spreads_across_keys_least_loaded(self):
        from app.llm import client

        pool = _multi_key_pool(3, vision_limit=5)
        with patch.object(client, "_get_pool", return_value=pool):
            labels = []
            held = []
            for _ in range(6):
                ks = await client._acquire("vision")
                held.append(ks)
                labels.append(ks.label)
            for ks in held:
                client._release(ks, "vision")
        # Round-robin-ish: each of 3 keys used twice, none starved.
        assert sorted(labels) == ["key1", "key1", "key2", "key2", "key3", "key3"]

    async def test_vision_and_text_pools_are_independent(self):
        from app.llm import client

        pool = _multi_key_pool(1, vision_limit=1, text_limit=1)
        with patch.object(client, "_get_pool", return_value=pool):
            v = await client._acquire("vision")  # saturate vision
            t = await client._acquire("text")  # text still free → must succeed
            assert v.label == t.label == "key1"
            client._release(v, "vision")
            client._release(t, "text")

    async def test_call_with_pool_fails_over_on_rate_limit(self):
        from app.llm import client

        c1, c2 = AsyncMock(), AsyncMock()
        c1.chat.completions.create.side_effect = _rate_limit_error()
        c2.chat.completions.create.return_value = _make_response("ok")
        pool = _multi_key_pool(2, clients=[c1, c2])
        with patch.object(client, "_get_pool", return_value=pool):
            resp, used = await client._call_with_pool(
                "vision", lambda cl: cl.chat.completions.create(), "vision"
            )
        assert used == "key2"

    async def test_call_with_pool_all_throttled_raises_rate_limit(self):
        from openai import RateLimitError

        from app.llm import client

        c1, c2 = AsyncMock(), AsyncMock()
        c1.chat.completions.create.side_effect = _rate_limit_error()
        c2.chat.completions.create.side_effect = _rate_limit_error()
        pool = _multi_key_pool(2, clients=[c1, c2])
        with (
            patch.object(client, "_get_pool", return_value=pool),
            patch.object(client.asyncio, "sleep", new_callable=AsyncMock),
        ):
            with pytest.raises(RateLimitError):
                await client._call_with_pool(
                    "vision", lambda cl: cl.chat.completions.create(), "vision"
                )
