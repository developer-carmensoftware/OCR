"""In-memory ring buffer for debug-only LLM response capture.

Used by /debug-llm endpoint when settings.app_debug=True. Replaces the previous
tempfile-based implementation so the backend stays true to its "no file storage"
contract (see CLAUDE.md).
"""

from __future__ import annotations

from collections import deque
from datetime import UTC, datetime
from threading import Lock
from typing import Any

_MAX_ENTRIES = 10
_buffer: deque[dict[str, Any]] = deque(maxlen=_MAX_ENTRIES)
_lock = Lock()


def record(raw_text: str, *, source: str = "vision_llm") -> None:
    """Store a raw LLM response. No-op safe under concurrency."""
    with _lock:
        _buffer.append(
            {
                "ts": datetime.now(UTC).isoformat(),
                "source": source,
                "raw": raw_text,
            }
        )


def latest() -> dict[str, Any] | None:
    """Return the most recent entry or None if buffer is empty."""
    with _lock:
        return _buffer[-1] if _buffer else None


def snapshot() -> list[dict[str, Any]]:
    """Return a copy of all entries (oldest first)."""
    with _lock:
        return list(_buffer)


def clear() -> None:
    with _lock:
        _buffer.clear()
