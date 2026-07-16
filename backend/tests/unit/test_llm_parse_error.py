"""
Unit tests for the vision-JSON parse guard in llm_service / ap_invoice_service.

Regression: `json.loads` on the vision output was unguarded, and `_error_response`
puts `str(exc)` straight into the response `detail`. A pilot user saw "Unterminated
string starting at: line 34 column 22 (char 839)" three times in one minute and
never came back. Broken model output must surface as LLMParseError (→ 422) with a
message a non-engineer can act on.
"""

import json

import pytest

from app.exceptions import LLMParseError
from app.services import llm_service


def test_message_is_readable_and_leaks_no_parser_internals():
    msg = str(LLMParseError())
    assert "Could not read this document" in msg
    # The vocabulary of a JSONDecodeError must never reach a user.
    for leak in ("Unterminated", "line 1 column", "char ", "Expecting value", "JSON"):
        assert leak not in msg


@pytest.mark.asyncio
async def test_broken_vision_json_raises_llmparseerror(monkeypatch):
    async def _truncated(*_args, **_kwargs):
        # Shape of a real failure: usage 0/0/0, content cut mid-string.
        return '{"bank_name": "BAY", "details": [{"transaction": "MD'

    monkeypatch.setattr(llm_service, "call_vision_llm", _truncated)

    with pytest.raises(LLMParseError) as exc_info:
        await llm_service.extract_from_image(b"\x89PNG\r\n\x1a\n", filename="statement.pdf")

    assert "Could not read this document" in str(exc_info.value)
    assert isinstance(exc_info.value.__cause__, json.JSONDecodeError)
