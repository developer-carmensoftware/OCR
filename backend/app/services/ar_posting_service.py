"""Mock Carmen AR posting service.

# ponytail: mock — swap body of post_ar_entry() when Carmen team delivers the real API
"""

from datetime import UTC, datetime


async def post_ar_entry(order_id: str, ar_code: str, amount: float) -> dict:
    """Post an advance deposit entry to Carmen ERP as an AR transaction."""
    ref = f"AR-{datetime.now(UTC).strftime('%Y%m%d')}-{str(order_id)[:8].upper()}"
    return {"success": True, "carmen_ar_ref": ref}
