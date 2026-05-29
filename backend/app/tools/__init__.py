"""
Tools Layer — reusable, composable business logic units.

Each tool is an async function that accepts typed inputs and returns a ToolResult.
Tools are independent of the HTTP layer and can be invoked directly by agent code.
"""

from app.tools.base import ToolResult

# NOTE: `registry` is intentionally NOT imported here. It imports
# `app.services.gl_suggestion_service`, which in turn imports `app.tools.base`,
# which triggers this package __init__. Eagerly importing registry here would
# create a circular import. Consumers use `from app.tools import registry`,
# which loads the submodule lazily without the cycle.
__all__ = ["ToolResult"]
