"""Carmen AR posting service — posts a paid order to the seller's Carmen ERP.

Admin context carries no per-session Carmen token (unlike the tenant proxy in
carmen_service), so a service credential from settings is used:
  settings.carmen_ar_url   — full endpoint (.../api/interfacePostAR/CarmenAI)
  settings.carmen_ar_token — Authorization header value

Reuses carmen_service's shared httpx client so AR calls get the same keep-alive
pool + outbound-call logging as every other Carmen request.

Also the rest of the admin screen's AR side: the customer-profile mapping (buyer →
Carmen AR code) and `post_ar_batch`, which posts paid orders through `post_ar_entry`.
"""

import logging
from datetime import UTC, datetime

from httpx import RequestError
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.exceptions import NotFoundError
from app.models.billing import ArCustomerProfile
from app.models.enums import BillingDocumentType, CreditOrderStatus
from app.models.orm import BillingDocument, CreditOrder
from app.models.schemas.credits import PostArResultItem
from app.services.billing.orders import _in_scope
from app.services.shared.carmen import get_http_client, wrap_network_error

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
        resp = await get_http_client().post(
            url, json=payload, headers={"Authorization": token, "User-Agent": "FastAPI-Proxy"}
        )
    except RequestError as exc:
        raise RuntimeError(wrap_network_error(exc).detail) from exc

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


# ── AR Customer Profiles ─────────────────────────────────────────────────────


async def list_ar_profiles(
    db: AsyncSession, *, search: str | None, unmapped_only: bool
) -> list[ArCustomerProfile]:
    """List AR customer profiles for Carmen AR code mapping."""
    q = select(ArCustomerProfile).where(ArCustomerProfile.deleted_at.is_(None))
    if unmapped_only:
        q = q.where(ArCustomerProfile.carmen_ar_code.is_(None))
    if search:
        like = f"%{search}%"
        q = q.where(
            ArCustomerProfile.buyer_name.ilike(like) | ArCustomerProfile.buyer_tax_id.ilike(like)
        )
    q = q.order_by(ArCustomerProfile.buyer_name)
    return list((await db.execute(q)).scalars().all())


async def update_ar_profile(
    db: AsyncSession, profile_id: str, carmen_ar_code: str
) -> ArCustomerProfile:
    """Set or update the Carmen AR code for a customer profile."""
    profile = (
        await db.execute(
            select(ArCustomerProfile).where(
                ArCustomerProfile.id == profile_id,
                ArCustomerProfile.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if profile is None:
        raise NotFoundError("Profile not found")

    profile.carmen_ar_code = carmen_ar_code.strip().upper() or None  # type: ignore[assignment]
    profile.updated_at = datetime.now(UTC)  # type: ignore[assignment]
    return profile


async def sync_ar_profiles(db: AsyncSession) -> dict:
    """Re-scan billing_documents for new unique buyers and upsert into ar_customer_profiles."""
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    sub = (
        select(
            BillingDocument.buyer_name,
            BillingDocument.buyer_tax_id,
            BillingDocument.buyer_branch,
        )
        .where(
            BillingDocument.deleted_at.is_(None),
            BillingDocument.buyer_name.isnot(None),
            BillingDocument.buyer_name != "",
        )
        .distinct()
    )
    rows = (await db.execute(sub)).all()

    # Empty-tax-id buyers aren't covered by the (tax_id, branch) unique index, so
    # dedupe them in-app by (name, branch) to avoid piling up duplicates each sync.
    existing_empty = {
        (n, b)
        for n, b in (
            await db.execute(
                select(ArCustomerProfile.buyer_name, ArCustomerProfile.buyer_branch).where(
                    ArCustomerProfile.deleted_at.is_(None),
                    ArCustomerProfile.buyer_tax_id == "",
                )
            )
        ).all()
    }

    inserted = 0
    for name, tax_id, branch in rows:
        tax_id = tax_id or ""
        branch = branch or ""
        if not tax_id:
            if (name, branch) in existing_empty:
                continue
            existing_empty.add((name, branch))
            db.add(ArCustomerProfile(buyer_name=name, buyer_tax_id="", buyer_branch=branch))
            inserted += 1
            continue
        stmt = (
            pg_insert(ArCustomerProfile)
            .values(buyer_name=name, buyer_tax_id=tax_id, buyer_branch=branch)
            .on_conflict_do_nothing(
                index_elements=["buyer_tax_id", "buyer_branch"],
                index_where=text("deleted_at IS NULL AND buyer_tax_id != ''"),
            )
        )
        result = await db.execute(stmt)
        if result.rowcount:
            inserted += 1

    return {"inserted": inserted, "scanned": len(rows)}


# ── Carmen AR Posting ────────────────────────────────────────────────────────


async def post_ar_batch(
    db: AsyncSession,
    order_ids: list[str],
    *,
    is_global: bool,
    tenant_scope: str,
) -> list[PostArResultItem]:
    """Batch-post paid orders to Carmen ERP as AR entries.

    Commits after each order (not once at batch end): the previous single-commit
    held every row's FOR UPDATE lock across every Carmen HTTP round-trip, and a
    failed batch-end commit after Carmen had already accepted a post left the order
    PAID — so a retry re-posted a duplicate AR entry. Per-order commit releases each
    lock right after its own HTTP call and makes a Carmen-accepted post durable
    before the next order, so a later failure never triggers a duplicate re-post.
    """
    results: list[PostArResultItem] = []

    for oid in order_ids:
        order = (
            await db.execute(
                select(CreditOrder)
                .where(CreditOrder.id == oid, CreditOrder.deleted_at.is_(None))
                .with_for_update()
            )
        ).scalar_one_or_none()

        if order is None:
            results.append(PostArResultItem(order_id=oid, success=False, error="Not found"))
            await db.commit()
            continue

        if not _in_scope(order, is_global=is_global, tenant_scope=tenant_scope):
            results.append(
                PostArResultItem(order_id=oid, success=False, error="Tenant out of scope")
            )
            await db.commit()
            continue

        if order.status != CreditOrderStatus.PAID:
            results.append(
                PostArResultItem(
                    order_id=oid, success=False, error=f"Status is '{order.status}', expected paid"
                )
            )
            await db.commit()
            continue

        # Look up AR code from the order's buyer (via proforma snapshot)
        proforma = (
            await db.execute(
                select(BillingDocument).where(
                    BillingDocument.order_id == oid,
                    BillingDocument.doc_type == BillingDocumentType.PROFORMA,
                    BillingDocument.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()

        ar_code = None
        if proforma and proforma.buyer_tax_id:
            profile = (
                await db.execute(
                    select(ArCustomerProfile).where(
                        ArCustomerProfile.buyer_tax_id == proforma.buyer_tax_id,
                        ArCustomerProfile.buyer_branch == (proforma.buyer_branch or ""),
                        ArCustomerProfile.deleted_at.is_(None),
                    )
                )
            ).scalar_one_or_none()
            if profile:
                ar_code = profile.carmen_ar_code

        if not ar_code:
            results.append(
                PostArResultItem(
                    order_id=oid, success=False, error="No AR code mapped for this buyer"
                )
            )
            await db.commit()
            continue

        # proforma is guaranteed non-None here — ar_code above was derived from it.
        assert proforma is not None
        try:
            resp = await post_ar_entry(
                # Carmen field mapping (interfacePostAR/CarmenAI):
                #   DealId=Proforma Invoice No, ClosingDate=Proforma Date,
                #   Description=Package+price, Remark=Contact Name/Tel/Email.
                # The proforma is the single source of truth for this order's figures
                # (no internal tax invoice is issued — Carmen ERP owns that document).
                deal_id=str(proforma.number),
                ar_code=str(ar_code),
                account_name=str(proforma.buyer_name or ""),
                closing_date=proforma.issue_date.isoformat() if proforma.issue_date else "",
                total=float(str(proforma.total)),
                net=float(str(proforma.subtotal)),
                vat=float(str(proforma.vat_amount)),
                description=f"Package : {proforma.description or order.pack_code} — {proforma.total} THB",
                remark=(
                    f"Contact Name : {proforma.buyer_contact_name or '-'}\n"
                    f"Tel. : {proforma.buyer_tel or '-'}\n"
                    f"Email : {proforma.buyer_email or '-'}"
                ),
            )
            order.status = CreditOrderStatus.COMPLETE  # type: ignore[assignment]
            order.carmen_ar_posted_at = datetime.now(UTC)  # type: ignore[assignment]
            order.carmen_ar_ref = resp["carmen_ar_ref"]
            results.append(
                PostArResultItem(order_id=oid, success=True, carmen_ar_ref=resp["carmen_ar_ref"])
            )
        except Exception as exc:
            logger.exception("AR posting failed for order %s", oid)
            results.append(PostArResultItem(order_id=oid, success=False, error=str(exc)))

        # Persist this order's outcome (COMPLETE on success) and release its lock
        # before moving to the next — see the per-order-commit rationale above.
        await db.commit()

    return results
