"""
Seed test credit orders spread across the order lifecycle, to populate the admin
order workspace during testing — then remove them with one command.

Every seeded row carries  payment_ref = SEED_TAG  so cleanup is a single,
complete hard-delete (orders + their billing documents). Nothing else is touched.

Usage (cd backend, venv active):
    python scripts/seed_test_orders.py                 # create 30 (default)
    python scripts/seed_test_orders.py --count 30
    python scripts/seed_test_orders.py --dry-run       # show the plan, write nothing
    python scripts/seed_test_orders.py --cleanup       # delete every seeded row + its docs

What it writes, per the documented flow (docs/Billing_Purchase_Flow.md):
    in_progress → order + proforma            (one with slip = "to review", one without = "awaiting")
    paid        → + tax invoice + approved_*  ("to post")
    complete    → + carmen_ar_*               ("posted")
    void        → + rejected_reason           ("rejected")

It does NOT grant credits or activate subscriptions: that would mutate the real
tenants' live balances/windows, and the admin workspace reads only
credit_orders + billing_documents. ponytail: order+doc artifacts only — add the
grant_credits/activate_subscription side effects if a test needs real entitlements.

One in_progress order per tenant is the hard DB limit
(uq_credit_orders_one_open_per_tenant), so in_progress is capped at the number
of tenants that don't already have an open order; the rest fan out across
paid/complete/void on every tenant round-robin.
"""

import argparse
import asyncio
import sys
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:
    sys.stdout.reconfigure(encoding="utf-8")  # Windows console is cp1252 — Thai/box chars crash it
except Exception:
    pass

import dotenv

dotenv.load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from sqlalchemy import delete, select  # noqa: E402

from app.database import async_session  # noqa: E402
from app.models.enums import BillingDocumentType, CreditOrderStatus  # noqa: E402
from app.models.orm import BillingDocument, CreditOrder, CreditPack, Tenant  # noqa: E402
from app.services import billing_document_service as bds  # noqa: E402
from app.services.credit_service import annual_price  # noqa: E402
from app.utils.tax import vat_on_top  # noqa: E402

SEED_TAG = "SEED_TEST"  # payment_ref marker — the only handle cleanup needs

# Fake buyers cycled across orders (name, tax_id, branch).
BUYERS = [
    ("บริษัท ทดสอบ อัลฟ่า จำกัด", "0105551000011", "สำนักงานใหญ่"),
    ("บริษัท เบต้า เทรดดิ้ง จำกัด", "0105551000022", "สาขา 1"),
    ("ห้างหุ้นส่วนจำกัด แกมม่า", "0105551000033", "สำนักงานใหญ่"),
    ("บริษัท เดลต้า โซลูชั่นส์ จำกัด", "0105551000044", "สำนักงานใหญ่"),
    ("Epsilon Imports Co., Ltd.", "0105551000055", "HQ"),
    ("บริษัท ซีต้า ฟู้ดส์ จำกัด", "0105551000066", "สาขา 2"),
    ("Eta Logistics Co., Ltd.", "0105551000077", "HQ"),
    ("บริษัท ทีต้า มีเดีย จำกัด", "0105551000088", "สำนักงานใหญ่"),
]

REJECT_REASONS = [
    "ยอดเงินในสลิปไม่ตรงกับใบแจ้งหนี้",
    "สลิปไม่ชัดเจน อ่านยอดไม่ได้",
    "ไม่พบรายการโอนเข้าบัญชี",
    "โอนเข้าบัญชีผิด",
]


# Workflow stage (admin-tab name) → (order status, slip uploaded?). The two
# in_progress stages are capped at one open order per tenant by the DB index
# uq_credit_orders_one_open_per_tenant.
STAGE_SPEC: dict[str, tuple[str, bool]] = {
    "awaiting_payment": ("in_progress", False),  # verify tab, no slip yet
    "to_review": ("in_progress", True),  # verify tab, slip uploaded ("To Verify")
    "to_post": ("paid", True),  # post-to-AR tab
    "posted": ("complete", True),
    "rejected": ("void", True),
}
INPROGRESS_STAGES = {"awaiting_payment", "to_review"}


def _funnel_plan(n: int, n_free: int) -> list[str]:
    """Default: spread across the whole lifecycle (in_progress capped at free tenants)."""
    n_inprog = min(n_free, n)
    inprog = (["awaiting_payment"] if n_inprog else []) + ["to_review"] * max(0, n_inprog - 1)
    rest = n - n_inprog
    rejected = round(rest * 0.30)
    to_post = round(rest * 0.30)
    posted = rest - rejected - to_post
    return inprog + ["to_post"] * to_post + ["posted"] * posted + ["rejected"] * rejected


def _stage_plan(n: int, n_free: int, stage: str) -> list[str]:
    """All n orders in one stage. in_progress stages are capped at free tenants."""
    return [stage] * (min(n, n_free) if stage in INPROGRESS_STAGES else n)


async def _free_tenants(db) -> list[Tenant]:
    """Tenants with no open (in_progress) order — eligible for an in_progress seed."""
    tenants = (await db.execute(select(Tenant).where(Tenant.deleted_at.is_(None)))).scalars().all()
    open_tids = set(
        (
            await db.execute(
                select(CreditOrder.tenant_id).where(
                    CreditOrder.status == CreditOrderStatus.IN_PROGRESS,
                    CreditOrder.deleted_at.is_(None),
                )
            )
        )
        .scalars()
        .all()
    )
    return [t for t in tenants if t.id not in open_tids]


async def seed(count: int, dry_run: bool, stage: str | None) -> None:
    async with async_session() as db:
        tenants = (
            (await db.execute(select(Tenant).where(Tenant.deleted_at.is_(None)))).scalars().all()
        )
        if not tenants:
            sys.exit("ERROR: no tenants found — nothing to attach orders to.")
        packs = (
            (await db.execute(select(CreditPack).where(CreditPack.is_active == True)))  # noqa: E712
            .scalars()
            .all()
        )
        if not packs:
            sys.exit("ERROR: no active credit packs found.")

        free = await _free_tenants(db)
        plan = _stage_plan(count, len(free), stage) if stage else _funnel_plan(count, len(free))

        print("─" * 60)
        print(
            f"Plan: {len(plan)} orders ({f'stage={stage}' if stage else 'funnel spread'}) "
            f"across {len(tenants)} tenant(s)"
        )
        for s in STAGE_SPEC:
            if plan.count(s):
                print(f"  {s:<16} {plan.count(s)}")
        if len(plan) < count:
            print(
                f"  NOTE: in_progress stages cap at {len(free)} free tenant(s) (1 open/tenant) — "
                f"requested {count}, creating {len(plan)}."
            )
            if not plan:
                print(
                    "        No free tenant slots. Run --cleanup first, or let an existing "
                    "open order be approved/rejected to free one."
                )
        print("─" * 60)
        if dry_run or not plan:
            print("[DRY RUN] No rows written." if dry_run else "Nothing to create.")
            return

        now = datetime.now(UTC)
        n = len(plan)
        inprog_i = 0
        for i, stage_i in enumerate(plan):
            status, has_slip = STAGE_SPEC[stage_i]
            created = now - timedelta(days=(n - i) * 1.3, hours=i % 12)  # oldest first
            pack = packs[i % len(packs)]
            buyer_name, tax_id, branch = BUYERS[i % len(BUYERS)]

            is_sub = pack.kind == "subscription"
            is_annual = is_sub and (i % 3 == 0)
            net = annual_price(str(pack.price_thb)) if is_annual else Decimal(str(pack.price_thb))
            _sub, _vat, gross = vat_on_top(net)

            # in_progress must land on a distinct free tenant; others round-robin all.
            if status == "in_progress":
                tenant = free[inprog_i]
                inprog_i += 1
            else:
                tenant = tenants[i % len(tenants)]

            order = CreditOrder(
                tenant_id=tenant.id,
                pack_code=pack.code,
                credits=pack.credits,
                amount_thb=gross,
                billing_period="annual" if is_annual else "monthly",
                proration_credit_thb=Decimal("0"),
                status=CreditOrderStatus(status),
                payment_ref=SEED_TAG,
                created_at=created,
                expires_at=created + timedelta(days=14),
            )

            if has_slip:
                order.slip_object_key = f"{tenant.id}/{SEED_TAG}/slip.jpg"
                order.slip_uploaded_at = created + timedelta(hours=2)

            if status in ("paid", "complete"):
                order.paid_at = created + timedelta(days=1)
                order.approved_by = "seed-admin@test.local"
                order.approved_at = created + timedelta(days=1)
            if status == "complete":
                order.carmen_ar_posted_at = created + timedelta(days=2)
                order.carmen_ar_ref = f"AR-SEED-{i + 1:04d}"
            if status == "void":
                order.rejected_reason = REJECT_REASONS[i % len(REJECT_REASONS)]

            db.add(order)
            await db.flush()  # need order.id for the documents

            buyer = bds.BuyerInfo(name=buyer_name, tax_id=tax_id, branch=branch)
            await bds.issue_document(
                db,
                tenant_id=str(tenant.id),
                order_id=str(order.id),
                doc_type=BillingDocumentType.PROFORMA,
                pack_code=pack.code,
                pack_description=(str(pack.description) or f"{pack.credits} credits")
                + (" (Annual — 12 months)" if is_annual else ""),
                credits=pack.credits,
                amount_thb=net,
                buyer=buyer,
            )
            if status in ("paid", "complete"):
                await bds.issue_document(
                    db,
                    tenant_id=str(tenant.id),
                    order_id=str(order.id),
                    doc_type=BillingDocumentType.TAX_INVOICE,
                    pack_code=pack.code,
                    pack_description=f"{pack.credits} credits",
                    credits=pack.credits,
                    amount_thb=net,
                    buyer=buyer,
                )

            await db.commit()
            print(f"  [{i + 1:>2}/{n}] {stage_i:<16} {pack.code:<13} ฿{gross:>9,.2f}  {buyer_name}")

        print("─" * 60)
        print(f"Done. Seeded {n} orders (payment_ref={SEED_TAG}).")
        print("Cleanup: python scripts/seed_test_orders.py --cleanup")


async def cleanup() -> None:
    async with async_session() as db:
        ids = (
            (await db.execute(select(CreditOrder.id).where(CreditOrder.payment_ref == SEED_TAG)))
            .scalars()
            .all()
        )
        if not ids:
            print(f"No seeded orders found (payment_ref={SEED_TAG}). Nothing to do.")
            return
        # FK: billing_documents.order_id → credit_orders.id, so docs go first.
        docs = (
            await db.execute(delete(BillingDocument).where(BillingDocument.order_id.in_(ids)))
        ).rowcount
        orders = (
            await db.execute(delete(CreditOrder).where(CreditOrder.payment_ref == SEED_TAG))
        ).rowcount
        await db.commit()
        print(f"Deleted {orders} orders and {docs} billing documents (payment_ref={SEED_TAG}).")


def main() -> None:
    p = argparse.ArgumentParser(description="Seed/cleanup test credit orders.")
    p.add_argument("--count", type=int, default=30, help="How many orders to seed (default 30)")
    p.add_argument(
        "--stage",
        choices=list(STAGE_SPEC),
        help="Seed only this stage (e.g. to_review = the 'To Verify' queue). "
        "Omit for the default funnel spread. in_progress stages cap at 1/tenant.",
    )
    p.add_argument("--cleanup", action="store_true", help="Delete all seeded orders + their docs")
    p.add_argument("--dry-run", action="store_true", help="Print the plan, write nothing")
    args = p.parse_args()
    if args.cleanup:
        asyncio.run(cleanup())
    else:
        asyncio.run(seed(args.count, args.dry_run, args.stage))


if __name__ == "__main__":
    main()
