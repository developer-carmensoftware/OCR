"""
Tools Router — HTTP interface to the tool registry.

Endpoints:
  GET  /api/v1/tools            list all registered tools + their schemas
  GET  /api/v1/tools/{name}     get schema for one tool
  POST /api/v1/tools/{name}     invoke a tool by name (JSON body = kwargs)

Note: tools that require a database session (submit_receipt) or raw bytes
(extract_receipt) cannot be called through this generic endpoint — those have
dedicated routers. The tools endpoint is primarily useful for LLM agents
calling stateless tools: suggest_gl_fixed_fields, suggest_gl_payment_types.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from app.auth import get_current_session, SessionInfo
from app.tools import registry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/tools", tags=["Tools"])

# Tools that require injected dependencies (bytes / DB session) — block generic invocation
_REQUIRES_INJECTION = {"extract_receipt", "submit_receipt"}


@router.get("")
async def list_tools(_session: SessionInfo = Depends(get_current_session)):
    """List all registered tools with their descriptions and input schemas."""
    tools = []
    for name in registry.list_tools():
        schema = registry.get_schema(name)
        tools.append({
            **schema,
            "invocable": name not in _REQUIRES_INJECTION,
        })
    return {"tools": tools, "count": len(tools)}


@router.get("/{name}")
async def get_tool_schema(name: str, _session: SessionInfo = Depends(get_current_session)):
    """Return description and input schema for a single tool."""
    schema = registry.get_schema(name)
    if schema is None:
        raise HTTPException(
            status_code=404,
            detail=f"Tool '{name}' not found. Available: {registry.list_tools()}",
        )
    return {**schema, "invocable": name not in _REQUIRES_INJECTION}


@router.post("/{name}")
async def invoke_tool(name: str, body: dict = {}, _session: SessionInfo = Depends(get_current_session)):
    """
    Invoke a registered tool by name.

    Request body: JSON object whose keys match the tool's input_schema.
    Response: ToolResult serialized as JSON.

    Tools that require database sessions or raw file bytes are blocked here —
    use their dedicated endpoints instead.
    """
    if name in _REQUIRES_INJECTION:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Tool '{name}' requires injected dependencies (db session or file bytes) "
                f"and cannot be invoked through the generic tools endpoint. "
                f"Use its dedicated endpoint instead."
            ),
        )

    schema = registry.get_schema(name)
    if schema is None:
        raise HTTPException(
            status_code=404,
            detail=f"Tool '{name}' not found. Available: {registry.list_tools()}",
        )

    logger.info(f"[tools] invoking '{name}' with keys={list(body.keys())}")
    result = await registry.invoke(name, **body)

    return JSONResponse(content=result.to_dict())
