"""
Unit tests for llm/client.py
Mocks AsyncOpenAI — no real API calls made.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


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
        text = "```json\n{\"key\": \"value\"}\n```"
        result = _strip_code_fences(text)
        assert result == '{"key": "value"}'

    def test_generic_fence_stripped(self):
        from app.llm.client import _strip_code_fences
        text = "```\n{\"a\": 1}\n```"
        result = _strip_code_fences(text)
        assert result == '{"a": 1}'

    def test_fence_without_closing_handled(self):
        from app.llm.client import _strip_code_fences
        text = "```json\n{\"x\": 1}"
        result = _strip_code_fences(text)
        # Should not crash; inner content extracted
        assert "{" in result


# ── B5: call_text_llm ─────────────────────────────────────────────────────────

class TestCallTextLlm:
    @pytest.fixture(autouse=True)
    def patch_deps(self):
        with patch("app.llm.client.get_client") as mock_get_client, \
             patch("app.services.usage_service.log_llm_usage", new_callable=AsyncMock), \
             patch("app.services.outbound_log_service.log_outbound", new_callable=AsyncMock):
            self.mock_client = AsyncMock()
            mock_get_client.return_value = self.mock_client
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

    async def test_B5_3_api_error_raises(self):
        # call_text_llm re-raises API errors (only JSON parse failures return None)
        from app.llm.client import call_text_llm
        self.mock_client.chat.completions.create.side_effect = Exception("network error")

        try:
            await call_text_llm("test prompt")
            raised = False
        except Exception:
            raised = True
        assert raised

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
        from app.llm.client import call_text_llm
        from app.config import settings
        self.mock_client.chat.completions.create.return_value = _make_response('{}')

        await call_text_llm("test prompt", model=None)

        call_args = self.mock_client.chat.completions.create.call_args
        assert call_args.kwargs["model"] == settings.openrouter_suggestion_model


# ── B5: call_vision_llm ───────────────────────────────────────────────────────

class TestCallVisionLlm:
    @pytest.fixture(autouse=True)
    def patch_deps(self):
        with patch("app.llm.client.get_client") as mock_get_client, \
             patch("app.services.usage_service.log_llm_usage", new_callable=AsyncMock), \
             patch("app.services.outbound_log_service.log_outbound", new_callable=AsyncMock):
            self.mock_client = AsyncMock()
            mock_get_client.return_value = self.mock_client
            yield

    async def test_B5_5_api_error_raises_runtime_error(self):
        from app.llm.client import call_vision_llm
        self.mock_client.chat.completions.create.side_effect = Exception("timeout")

        with pytest.raises(RuntimeError, match="LLM API call failed"):
            await call_vision_llm(
                system_prompt="sys", user_content=[{"type": "text", "text": "hi"}],
                model="test-model"
            )

    async def test_B5_6_empty_content_raises_runtime_error(self):
        from app.llm.client import call_vision_llm
        self.mock_client.chat.completions.create.return_value = _make_response(None)

        with pytest.raises(RuntimeError, match="empty content"):
            await call_vision_llm(
                system_prompt="sys", user_content=[{"type": "text", "text": "hi"}],
                model="test-model"
            )

    async def test_success_returns_stripped_content(self):
        from app.llm.client import call_vision_llm
        self.mock_client.chat.completions.create.return_value = _make_response("  hello  ")

        result = await call_vision_llm(
            system_prompt="sys", user_content=[{"type": "text", "text": "hi"}],
            model="test-model"
        )

        assert result == "hello"

    async def test_log_llm_usage_called_when_usage_present(self):
        from app.llm.client import call_vision_llm
        self.mock_client.chat.completions.create.return_value = _make_response("ok")

        with patch("app.services.usage_service.log_llm_usage", new_callable=AsyncMock) as mock_log:
            with patch("app.services.outbound_log_service.log_outbound", new_callable=AsyncMock):
                await call_vision_llm(
                    system_prompt="sys", user_content=[], model="test-model",
                    task_id="task-1", module_id="credit_card_ocr"
                )
            mock_log.assert_called_once()
            kwargs = mock_log.call_args.kwargs
            assert kwargs["module_id"] == "credit_card_ocr"
