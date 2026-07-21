"""Carmen AR posting service — posts a paid order to the seller's Carmen ERP.

Admin context carries no per-session Carmen token (unlike the tenant proxy in
carmen_service), so a service credential from settings is used:
  settings.carmen_ar_url   — full endpoint (.../api/interfacePostAR/CarmenAI)
  settings.carmen_ar_token — Authorization header value

Reuses carmen_service's shared httpx client so AR calls get the same keep-alive
pool + outbound-call logging as every other Carmen request.
"""

import logging
from datetime import UTC, datetime

from httpx import RequestError

from app.config import settings
from app.services.carmen_service import _get_client, _wrap_network_error

logger = logging.getLogger(__name__)


async def post_ar_entry(
    *,
    deal_id: str,
    ar_code: str,
    account_name: str,
    closing_date: str,
    total: float,
    net: float,
    vat: float,
    description: str,
    remark: str,
) -> dict:
    """Post one order to Carmen as an AR entry.

    Returns {"success": True, "carmen_ar_ref": <ref>} on Carmen Code==0.
    Raises RuntimeError on misconfig, network failure, or a non-zero Carmen Code.
    """
    url = (settings.carmen_ar_url or "").strip()
    token = (settings.carmen_ar_token or "").strip()
    if not url or not token:
        raise RuntimeError(
            "Carmen AR endpoint not configured (set carmen_ar_url / carmen_ar_token)"
        )

    payload = {
        "DealId": deal_id,
        "ArNo": ar_code,
        "AccountName": account_name,
        "ClosingDate": closing_date or datetime.now(UTC).isoformat(),
        "Description": description,
        "TotalAmount": round(total, 2),
        "Amount": round(net, 2),
        "ServiceAmount": 0,
        "TaxAmount": round(vat, 2),
        "Remark": remark,
    }

    try:
        resp = await _get_client().post(
            url, json=payload, headers={"Authorization": token, "User-Agent": "FastAPI-Proxy"}
        )
    except RequestError as exc:
        raise RuntimeError(_wrap_network_error(exc).detail) from exc

    try:
        data = resp.json()
    except ValueError:
        raise RuntimeError(f"Carmen AR returned non-JSON ({resp.status_code}): {resp.text[:200]}")

    # Carmen success contract: Code == 0. UserMessage carries the human-readable error.
    if data.get("Code") != 0:
        msg = (
            data.get("UserMessage") or data.get("InternalMessage") or "Carmen AR rejected the post"
        )
        raise RuntimeError(msg)

    # No AR document number is returned in the response body — use Carmen's MoreInfo
    # if present, else fall back to the ArNo we posted under as the stored reference.
    ref = (data.get("MoreInfo") or "").strip() or ar_code
    logger.info("AR posted: deal=%s ar_no=%s ref=%s", deal_id, ar_code, ref)
    return {"success": True, "carmen_ar_ref": ref}
