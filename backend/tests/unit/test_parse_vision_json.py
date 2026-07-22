"""parse_vision_json — the single parse path for every vision module.

Guards the error class behind the 2026-07-22 OOM incident: a list-wrapped or
non-object LLM response must become LLMParseError, never an AttributeError 500.
"""

import pytest

from app.exceptions import LLMParseError
from app.llm.client import parse_vision_json


def test_plain_object_passes_through():
    assert parse_vision_json('{"a": 1}') == {"a": 1}


def test_markdown_fences_stripped():
    assert parse_vision_json('```json\n{"a": 1}\n```') == {"a": 1}


def test_one_element_array_unwrapped():
    assert parse_vision_json('[{"a": 1}]') == {"a": 1}


@pytest.mark.parametrize("raw", ["[]", '"string"', "42", "[1, 2]", "not json at all"])
def test_non_object_raises_parse_error(raw):
    with pytest.raises(LLMParseError):
        parse_vision_json(raw)
