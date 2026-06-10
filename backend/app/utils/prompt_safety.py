"""Sanitize untrusted text before it is interpolated into an LLM prompt.

OCR'd document text and vendor history coming back from Carmen are attacker-
influenceable. If interpolated raw, a crafted value containing newlines or
instruction-like phrasing can break out of its data line and steer the model
("ignore previous instructions…"). We can't make prompts injection-proof, but
we flatten the text to a single line, drop control characters, neutralise the
quote/arrow delimiters our prompt lines rely on, and cap length so a value
cannot dominate the prompt.
"""

import re

_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")
_WS = re.compile(r"\s+")

# Default cap — generous for a line-item description, finite enough that no single
# field can blow up the prompt.
_DEFAULT_MAX = 500


def sanitize_prompt_text(text: object, max_len: int = _DEFAULT_MAX) -> str:
    """Flatten/escape untrusted text for safe interpolation into a prompt line."""
    if text is None:
        return ""
    s = str(text)
    # Collapse all whitespace (incl. newlines/tabs) to single spaces so the value
    # stays on one line and cannot inject new prompt directives.
    s = _CONTROL_CHARS.sub(" ", s)
    s = _WS.sub(" ", s).strip()
    # Neutralise the delimiters our prompt templates use to structure data lines.
    s = s.replace('"', "'").replace("→", "->").replace("`", "'")
    if len(s) > max_len:
        s = s[:max_len] + "…"
    return s
