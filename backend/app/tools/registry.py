"""
Tool Registry — enables agent-style invocation by name.

Usage:
    from app.tools import registry

    names  = registry.list_tools()
    schema = registry.get_schema("extract_card")
    result = await registry.invoke("extract_card", file_bytes=b"...", filename="r.jpg")

Each registered tool declares a JSON Schema for its inputs.
`invoke()` validates inputs against the schema before calling the function,
returning a failed ToolResult with clear errors instead of a raw exception.
"""

from collections.abc import Callable
from typing import Any, cast

from app.tools import extract, map_gl, submit
from app.tools.base import ToolResult

# ── JSON Schema definitions ───────────────────────────────────────────────────

_SCHEMA_EXTRACT = {
    "type": "object",
    "required": ["file_bytes", "filename"],
    "properties": {
        "file_bytes": {"type": "string", "description": "Raw file content (bytes)"},
        "filename": {
            "type": "string",
            "minLength": 1,
            "description": "Original filename — determines MIME type",
        },
        "bank_type": {
            "type": "string",
            "enum": ["SCB", "BBL", "KBANK"],
            "description": "Bank-specific prompt selector",
        },
    },
    "additionalProperties": True,
}

_SCHEMA_SUBMIT = {
    "type": "object",
    "required": ["inp", "db"],
    "properties": {
        "inp": {"description": "SubmitInput dataclass"},
        "db": {"description": "AsyncSession — injected by router"},
    },
    "additionalProperties": True,
}

_SCHEMA_GL_FIXED = {
    "type": "object",
    "required": ["accounts", "departments"],
    "properties": {
        "accounts": {
            "type": "array",
            "items": {"type": "object"},
            "description": "list[{code, name, type?}]",
        },
        "departments": {
            "type": "array",
            "items": {"type": "object"},
            "description": "list[{code, name}]",
        },
    },
    "additionalProperties": True,
}

_SCHEMA_GL_PAYMENT = {
    "type": "object",
    "required": ["payment_types", "accounts", "departments"],
    "properties": {
        "payment_types": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": 1,
            "description": "list[str] — e.g. ['Visa', 'MCA', 'QR']",
        },
        "accounts": {"type": "array", "items": {"type": "object"}},
        "departments": {"type": "array", "items": {"type": "object"}},
    },
    "additionalProperties": True,
}


# ── Registry entries ──────────────────────────────────────────────────────────

_REGISTRY: dict[str, dict] = {
    extract.TOOL_NAME: {
        "fn": extract.run,
        "description": "Extract structured data from a bank receipt/credit card document using Vision LLM",
        "input_schema": _SCHEMA_EXTRACT,
    },
    submit.TOOL_NAME: {
        "fn": submit.run,
        "description": "Persist confirmed credit card document data to the local database",
        "input_schema": _SCHEMA_SUBMIT,
    },
    map_gl.TOOL_FIXED: {
        "fn": map_gl.suggest_fixed_fields,
        "description": "LLM-suggest GL account/dept codes for Credit card commission, Input Tax, Bank Account",
        "input_schema": _SCHEMA_GL_FIXED,
    },
    map_gl.TOOL_PAYMENT: {
        "fn": map_gl.suggest_payment_types,
        "description": "LLM-suggest GL account/dept codes for dynamic payment types (Visa, MCA, QR, …)",
        "input_schema": _SCHEMA_GL_PAYMENT,
    },
}


# ── Validation ────────────────────────────────────────────────────────────────


def _validate_inputs(schema: dict, kwargs: dict) -> list[str]:
    """
    Minimal JSON Schema validation (required fields + enum checks).
    Returns a list of error strings; empty list means valid.
    Avoids adding jsonschema as a hard dependency.
    """
    errors: list[str] = []
    props = schema.get("properties", {})

    for field in schema.get("required", []):
        if field not in kwargs:
            errors.append(f"Missing required input: '{field}'")

    for field, value in kwargs.items():
        field_schema = props.get(field)
        if not field_schema:
            continue
        allowed = field_schema.get("enum")
        if allowed and value not in allowed:
            errors.append(f"'{field}' must be one of {allowed}, got {value!r}")
        min_items = field_schema.get("minItems")
        if min_items is not None and isinstance(value, list) and len(value) < min_items:
            errors.append(f"'{field}' must have at least {min_items} item(s)")
        min_len = field_schema.get("minLength")
        if min_len is not None and isinstance(value, str) and len(value) < min_len:
            errors.append(f"'{field}' must be at least {min_len} character(s)")

    return errors


# ── Public API ────────────────────────────────────────────────────────────────


def list_tools() -> list[str]:
    return list(_REGISTRY.keys())


def get_schema(name: str) -> dict | None:
    entry = _REGISTRY.get(name)
    if not entry:
        return None
    return {
        "name": name,
        "description": entry["description"],
        "input_schema": entry["input_schema"],
    }


def get_fn(name: str) -> Callable | None:
    entry = _REGISTRY.get(name)
    return entry["fn"] if entry else None


async def invoke(name: str, **kwargs: Any) -> ToolResult:
    """
    Invoke a registered tool by name.

    Validates inputs against the tool's JSON Schema before calling.
    Returns a failed ToolResult on unknown tool, validation error, or exception.
    """
    entry = _REGISTRY.get(name)
    if entry is None:
        return ToolResult(
            success=False,
            tool=name,
            input=kwargs,
            errors=[f"Tool '{name}' not found. Available: {list_tools()}"],
        )

    errors = _validate_inputs(entry["input_schema"], kwargs)
    if errors:
        return ToolResult(
            success=False,
            tool=name,
            input=kwargs,
            errors=errors,
        )

    try:
        return cast(ToolResult, await entry["fn"](**kwargs))
    except Exception as exc:
        return ToolResult(
            success=False,
            tool=name,
            input=kwargs,
            errors=[f"{type(exc).__name__}: {exc}"],
        )
