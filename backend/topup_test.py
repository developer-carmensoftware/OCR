"""
Simulate the full top-up purchase flow for a tenant.

Flow mirrors the two API endpoints exactly:
  Step 1 — POST /api/v1/credits/orders          (tenant creates pending order)
  Step 2 — POST /api/v1/admin/.../credits/topup  (admin marks paid + grants credits)

Run from backend/:
    python topup_test.py
"""

import asyncio
import sys
import uuid
from datetime import UTC, datetime

TENANT_ID = "a82e56ff-d05a-4f6d-9f62-3a6d52183ac2"
PACK_CODE = "p1000"
ADMIN_EMAIL = "test-script@carmen-ai.local"


async def main() -> None:
    # Import inside async so the app env (dotenv, DB engine) is ready
    from sqlalchemy import select

    from app.database import async_session
    from app.models.enums import CreditLedgerReason, CreditOrderStatus
    from app.models.orm import CreditLedger, CreditOrder, CreditPack
    from app.services.credit_service import get_credit_balance, grant_credits

    tenant_uuid = uuid.UUID(TENANT_ID)

    # ── Pre-check: current balance ─────────────────────────────────────────────
    balance_before = await get_credit_balance(TENANT_ID)
    print(f"\n[PRE]  tenant={TENANT_ID}")
    print(f"       balance before = {balance_before} credits")

    async with async_session() as db:
        # ── Verify pack exists ─────────────────────────────────────────────────
        pack = (
            await db.execute(select(CreditPack).where(CreditPack.code == PACK_CODE))
        ).scalar_one_or_none()
        if pack is None or not pack.is_active:
            print(f"\n[ERROR] Pack '{PACK_CODE}' not found or inactive. Aborting.")
            sys.exit(1)
        print(f"\n[PACK] {pack.code}: {pack.credits} credits @ THB {pack.price_thb}")

        # ── STEP 1: Tenant creates pending order ───────────────────────────────
        # Mirrors POST /api/v1/credits/orders
        order = CreditOrder(
            tenant_id=tenant_uuid,
            pack_code=pack.code,
            credits=pack.credits,
            amount_thb=pack.price_thb,
            status=CreditOrderStatus.PENDING,
        )
        db.add(order)
        await db.commit()
        await db.refresh(order)
        print("\n[STEP 1] Order created (PENDING)")
        print(f"         order_id = {order.id}")
        print(f"         credits  = {order.credits}")
        print(f"         amount   = THB {order.amount_thb}")
        print(f"         status   = {order.status}")

    # ── STEP 2: Admin approves — mark PAID + grant credits ─────────────────────
    # Mirrors POST /api/v1/admin/tenants/{tenant_id}/credits/topup
    async with async_session() as db:
        async with db.begin():
            # Re-fetch order in this session
            order_row = (
                await db.execute(select(CreditOrder).where(CreditOrder.id == order.id))
            ).scalar_one()

            if order_row.status == CreditOrderStatus.PAID:
                print("\n[ERROR] Order already fulfilled. Aborting.")
                sys.exit(1)

            now = datetime.now(UTC).replace(tzinfo=None)
            order_row.status = CreditOrderStatus.PAID  # type: ignore[assignment]
            order_row.paid_at = now  # type: ignore[assignment]
            order_row.approved_by = ADMIN_EMAIL  # type: ignore[assignment]
            order_row.approved_at = now  # type: ignore[assignment]

            new_balance = await grant_credits(
                db,
                TENANT_ID,
                pack.credits,  # type: ignore[arg-type]
                reason=CreditLedgerReason.TOPUP,
                pack_code=pack.code,  # type: ignore[arg-type]
                ref=str(order_row.id),
            )
            # db.begin() commits on context exit

    print("\n[STEP 2] Admin approved — order marked PAID, credits granted")
    print(f"         approved_by = {ADMIN_EMAIL}")
    print(f"         new balance = {new_balance} credits")

    # ── Verify: ledger tail ────────────────────────────────────────────────────
    async with async_session() as db:
        ledger_rows = (
            (
                await db.execute(
                    select(CreditLedger)
                    .where(CreditLedger.tenant_id == tenant_uuid)
                    .order_by(CreditLedger.created_at.desc())
                    .limit(3)
                )
            )
            .scalars()
            .all()
        )

    print(f"\n[LEDGER] Last {len(ledger_rows)} entries (newest first):")
    for row in ledger_rows:
        print(
            f"  {row.created_at.strftime('%Y-%m-%d %H:%M:%S')}  "
            f"delta={row.delta:+d}  balance_after={row.balance_after}  "
            f"reason={row.reason}  pack={row.pack_code}  ref={str(row.ref or '')[:36]}"
        )

    balance_after = await get_credit_balance(TENANT_ID)
    print(f"\n[POST] balance after  = {balance_after} credits")
    print(f"       delta          = +{balance_after - balance_before} credits\n")

    if balance_after == balance_before + pack.credits:
        print("[OK] Flow completed successfully — balance matches expected value.")
    else:
        print(
            f"[WARN] Expected {balance_before + pack.credits}, got {balance_after}. Check ledger."
        )


if __name__ == "__main__":
    asyncio.run(main())
