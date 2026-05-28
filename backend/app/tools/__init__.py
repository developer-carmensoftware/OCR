"""
Tools Layer — reusable, composable business logic units.

Each tool is an async function that accepts typed inputs and returns a ToolResult.
Tools are independent of the HTTP layer and can be invoked directly by agent code.
"""

from app.tools.base import ToolResult

__all__ = ["ToolResult"]
