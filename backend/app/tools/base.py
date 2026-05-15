"""
Standard ToolResult — unified response format for all tools.

Every tool returns a ToolResult so agent code can handle results consistently
regardless of which tool was called.
"""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ToolResult:
    """Standardized output from any tool invocation."""

    success: bool
    tool: str
    input: dict[str, Any]
    output: Any = None
    metadata: dict[str, Any] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "tool": self.tool,
            "input": self.input,
            "output": self.output,
            "metadata": self.metadata,
            "errors": self.errors,
        }
