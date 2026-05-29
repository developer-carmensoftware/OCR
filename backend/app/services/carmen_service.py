"""
Carmen API Service — all HTTP calls to the Carmen Cloud API.

Every public function accepts `carmen_token: str` so the caller's session token
is used per-request instead of a shared env-var credential.

Outbound calls are logged via httpx event hooks to prove data only reaches Carmen.
"""

import logging
import time
from typing import Any

import httpx
from httpx import ConnectError, RequestError, TimeoutException

logger = logging.getLogger(__name__)

_TIMEOUT = 30.0


def _base_url() -> str:
    """Derive Carmen API base URL from the current session's carmen_uri context var."""
    from app.context import current_carmen_uri

    uri = current_carmen_uri.get() or ""
    if not uri:
        raise RuntimeError("carmen_uri not set in context — session may be missing uri")
    return f"{uri.rstrip('/')}/Carmen.API/api/interface"


def _headers(carmen_token: str) -> dict[str, str]:
    from app.context import current_request_id

    headers = {
        "Authorization": carmen_token,
        "User-Agent": "FastAPI-Proxy",
    }
    rid = current_request_id.get("")
    if rid:
        headers["X-Request-ID"] = rid
    return headers


class CarmenAPIError(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


# ── httpx event hooks for outbound logging ────────────────────────────────────


async def _on_request(request: httpx.Request) -> None:
    """Record request start time on the request's extensions dict."""
    request.extensions["_start"] = time.perf_counter()


async def _on_response(response: httpx.Response) -> None:
    """Fire-and-forget log entry after Carmen responds, plus session deactivation on 401."""
    from app.services.outbound_log_service import log_outbound

    start = response.request.extensions.get("_start", time.perf_counter())
    duration_ms = (time.perf_counter() - start) * 1000
    await log_outbound(
        service="carmen",
        url=str(response.request.url),
        method=response.request.method,
        status_code=response.status_code,
        duration_ms=duration_ms,
        request_size_bytes=int(response.request.headers.get("content-length", 0) or 0),
    )
    if response.status_code == 401:
        await _deactivate_current_session()


async def _deactivate_current_session() -> None:
    """Mark the current request's OcrSession as inactive after a Carmen 401.
    Carmen is the source of truth for token validity — once it rejects the token,
    further calls in this session are pointless. Failure to update is swallowed
    so the calling request continues to surface the 401 to the user."""
    from sqlalchemy import update

    from app.context import current_ocr_session_id as current_session_id
    from app.database import async_session
    from app.models.orm import OcrSession

    sid = current_session_id.get() or ""
    if not sid:
        return
    try:
        async with async_session() as db:
            await db.execute(update(OcrSession).where(OcrSession.id == sid).values(is_active=False))
            await db.commit()
        from app.auth.dependencies import invalidate_session_cache

        invalidate_session_cache(sid)
        logger.info("Carmen returned 401 — session %s deactivated", sid)
    except Exception:
        logger.exception("Failed to deactivate session %s after Carmen 401", sid)


# Module-level AsyncClient — reused across all Carmen calls.
# Without this, a fresh TCP+TLS handshake fires on every call (4-6 per AP-invoice
# flow), adding 50-200ms latency each. The shared pool keeps connections alive
# (HTTP keep-alive) so subsequent calls reuse the same socket.
#
# Auth header is injected per-request (token differs per session); the client
# itself is token-agnostic.
_SHARED_CLIENT: httpx.AsyncClient | None = None
_HTTP_LIMITS = httpx.Limits(
    max_connections=100,
    max_keepalive_connections=20,
    keepalive_expiry=30.0,
)


def _get_client() -> httpx.AsyncClient:
    """Lazy-init the shared AsyncClient. Lifespan should call close_client() on shutdown."""
    global _SHARED_CLIENT
    if _SHARED_CLIENT is None or _SHARED_CLIENT.is_closed:
        _SHARED_CLIENT = httpx.AsyncClient(
            timeout=_TIMEOUT,
            limits=_HTTP_LIMITS,
            event_hooks={"request": [_on_request], "response": [_on_response]},
        )
    return _SHARED_CLIENT


async def close_client() -> None:
    """Close the shared Carmen client on app shutdown. Called from lifespan."""
    global _SHARED_CLIENT
    if _SHARED_CLIENT is not None and not _SHARED_CLIENT.is_closed:
        await _SHARED_CLIENT.aclose()
        _SHARED_CLIENT = None


# ── Service functions ─────────────────────────────────────────────────────────


def _wrap_network_error(exc: RequestError) -> CarmenAPIError:
    if isinstance(exc, ConnectError):
        return CarmenAPIError(
            503, "Unable to connect to Carmen Server. Please check your connection and try again."
        )
    if isinstance(exc, TimeoutException):
        return CarmenAPIError(504, "Carmen Server request timed out. Please try again.")
    return CarmenAPIError(503, f"Connection to Carmen failed: {exc}")


async def get_account_codes(carmen_token: str) -> Any:
    try:
        resp = await _get_client().get(f"{_base_url()}/accountCode", headers=_headers(carmen_token))
        if resp.status_code != 200:
            raise CarmenAPIError(resp.status_code, resp.text)
        return resp.json()
    except RequestError as e:
        raise _wrap_network_error(e) from e


async def get_departments(carmen_token: str) -> Any:
    try:
        resp = await _get_client().get(f"{_base_url()}/department", headers=_headers(carmen_token))
        if resp.status_code != 200:
            raise CarmenAPIError(resp.status_code, resp.text)
        return resp.json()
    except RequestError as e:
        raise _wrap_network_error(e) from e


async def get_gl_prefix(carmen_token: str) -> Any:
    try:
        resp = await _get_client().get(f"{_base_url()}/glPrefix", headers=_headers(carmen_token))
        if resp.status_code != 200:
            return {"Data": [], "Status": f"upstream_{resp.status_code}"}
        return resp.json()
    except RequestError as e:
        logger.warning("Carmen glPrefix unreachable: %s", e)
        return {"Data": [], "Status": "upstream_unreachable"}


async def post_gljv(body: dict, carmen_token: str) -> Any:
    try:
        resp = await _get_client().post(
            f"{_base_url()}/gljv", json=body, headers=_headers(carmen_token)
        )
        try:
            return resp.json()
        except ValueError:
            raise CarmenAPIError(resp.status_code, resp.text)
    except CarmenAPIError:
        raise
    except RequestError as e:
        raise _wrap_network_error(e) from e


async def put_gljv(jvh_seq: int, body: dict, carmen_token: str) -> Any:
    try:
        resp = await _get_client().put(
            f"{_base_url()}/gljv/{jvh_seq}", json=body, headers=_headers(carmen_token)
        )
        try:
            return resp.json()
        except ValueError:
            raise CarmenAPIError(resp.status_code, resp.text)
    except CarmenAPIError:
        raise
    except RequestError as e:
        raise _wrap_network_error(e) from e


_VENDOR_FIELDS = frozenset(
    {
        "VnCode",
        "VnName",
        "Active",
        "VnTaxNo",
        "VnCateCode",
        "VnCateDesc",
        "VnVat1DrAccCode",
        "VnVat1DrAccDesc",
        "VnVat1DrDeptCode",
        "VnVat1DrDeptDesc",
        "VnVatCrAccCode",
        "VnVatCrAccDesc",
        "VnCrDeptCode",
        "VnCrDeptDesc",
        "TaxProfileCode1",
        "TaxProfileDesc1",
        "BranchNo",
        "VnTerm",
    }
)


async def get_vendors(carmen_token: str) -> Any:
    try:
        resp = await _get_client().get(f"{_base_url()}/vendor", headers=_headers(carmen_token))
        if resp.status_code != 200:
            raise CarmenAPIError(resp.status_code, resp.text)
        data = resp.json()
        if isinstance(data, dict) and isinstance(data.get("Data"), list):
            data["Data"] = [
                {k: v for k, v in item.items() if k in _VENDOR_FIELDS} for item in data["Data"]
            ]
        return data
    except RequestError as e:
        raise _wrap_network_error(e) from e


async def get_vendor_invoices(vn_code: str, carmen_token: str) -> Any:
    """Fetch a vendor's prior invoice line items from Carmen.

    Returns the raw list (or {"Data": [...]} wrapper) — caller normalizes.
    Empty list on 404 (vendor has no history) to keep callers branch-free.
    """
    try:
        resp = await _get_client().get(
            f"{_base_url()}/spGetListInvoiceByVnCode/{vn_code}", headers=_headers(carmen_token)
        )
        if resp.status_code == 404:
            return []
        if resp.status_code != 200:
            raise CarmenAPIError(resp.status_code, resp.text)
        return resp.json()
    except RequestError as e:
        raise _wrap_network_error(e) from e


async def get_jv_by_source(source: str, carmen_token: str) -> Any:
    """Fetch prior GL JV detail lines for a credit-card JV `source`.

    Mirrors `get_vendor_invoices` — returns the raw list (or {"Data": [...]}
    wrapper); caller normalizes. Empty list on 404 (no prior JVs for source).
    """
    try:
        resp = await _get_client().get(
            f"{_base_url()}/spGetListJvBySource/{source}", headers=_headers(carmen_token)
        )
        if resp.status_code == 404:
            return []
        if resp.status_code != 200:
            raise CarmenAPIError(resp.status_code, resp.text)
        return resp.json()
    except RequestError as e:
        raise _wrap_network_error(e) from e


async def get_tax_profiles(carmen_token: str) -> Any:
    try:
        resp = await _get_client().get(f"{_base_url()}/taxProfile", headers=_headers(carmen_token))
        if resp.status_code != 200:
            raise CarmenAPIError(resp.status_code, resp.text)
        return resp.json()
    except RequestError as e:
        raise _wrap_network_error(e) from e


async def get_period_list(carmen_token: str) -> Any:
    try:
        resp = await _get_client().get(
            f"{_base_url()}/getPeriodList", headers=_headers(carmen_token)
        )
        if resp.status_code != 200:
            raise CarmenAPIError(resp.status_code, resp.text)
        return resp.json()
    except RequestError as e:
        raise _wrap_network_error(e) from e


async def post_input_tax(body: dict, carmen_token: str) -> Any:
    try:
        resp = await _get_client().post(
            f"{_base_url()}/inputTaxRec", json=body, headers=_headers(carmen_token)
        )
        try:
            return resp.json()
        except ValueError:
            raise CarmenAPIError(resp.status_code, resp.text)
    except CarmenAPIError:
        raise
    except RequestError as e:
        raise _wrap_network_error(e) from e


async def put_input_tax(rec_seq: int, body: dict, carmen_token: str) -> Any:
    try:
        resp = await _get_client().put(
            f"{_base_url()}/inputTaxRec/{rec_seq}", json=body, headers=_headers(carmen_token)
        )
        try:
            return resp.json()
        except ValueError:
            raise CarmenAPIError(resp.status_code, resp.text)
    except CarmenAPIError:
        raise
    except RequestError as e:
        raise _wrap_network_error(e) from e


async def post_invoice(body: dict, carmen_token: str) -> Any:
    try:
        resp = await _get_client().post(
            f"{_base_url()}/invoice", json=body, headers=_headers(carmen_token)
        )
        try:
            return resp.json()
        except ValueError:
            raise CarmenAPIError(resp.status_code, resp.text)
    except CarmenAPIError:
        raise
    except RequestError as e:
        raise _wrap_network_error(e) from e
