"""
Print the exact Carmen AR JSON payload that POST /admin/credit-orders/post-ar
sends, for a given net (pre-VAT) catalog price — no DB, no network.

Reproduces the real math (app.utils.tax.vat_on_top) and the real payload shape
(app.services.ar_posting_service.post_ar_entry), so you can eyeball the numbers
without pulling them out of network devtools.

Usage (cd backend, venv active):
    python scripts/simulate_ar_payload.py                  # default: sub_starter, 490 THB net
    python scripts/simulate_ar_payload.py --price 990
    python scripts/simulate_ar_payload.py --price 490 --pack "Starter Plan — 200 credits/month"
"""

import argparse
import json
import sys
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")  # Windows console is cp1252 — em dashes crash it
except Exception:
    pass

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.utils.tax import vat_on_top  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--price", type=str, default="490", help="Net (pre-VAT) catalog price_thb")
    ap.add_argument("--pack", type=str, default="Starter Plan — 200 credits/month")
    ap.add_argument("--proforma-no", type=str, default="PI-202607-0001")
    ap.add_argument("--ar-code", type=str, default="C001")
    ap.add_argument("--buyer", type=str, default="Camen Cloud Co.,Ltd.")
    ap.add_argument("--contact", type=str, default="Boonyawat Jiratthanasaweat")
    ap.add_argument("--tel", type=str, default="022840429")
    ap.add_argument("--email", type=str, default="support@carmensoftware.com")
    args = ap.parse_args()

    net, vat, gross = vat_on_top(Decimal(args.price))

    # Mirrors routers/admin/credits.py's post_ar exactly: everything sourced
    # from the proforma (single source of truth) — no internal tax invoice.
    payload = {
        "DealId": args.proforma_no,
        "ArNo": args.ar_code,
        "AccountName": args.buyer,
        "ClosingDate": datetime.now(UTC).isoformat(),
        "Description": f"Package : {args.pack} — {gross} THB",
        "TotalAmount": round(float(gross), 2),
        "Amount": round(float(net), 2),
        "ServiceAmount": 0,
        "TaxAmount": round(float(vat), 2),
        "Remark": (f"Contact Name : {args.contact}\nTel. : {args.tel}\nEmail : {args.email}"),
    }

    print(f"\nnet (price_thb, ex-VAT) : {net}")
    print(f"vat (7%)                : {vat}")
    print(f"gross (customer paid)   : {gross}\n")
    print("Carmen AR payload (POST interfacePostAR/CarmenAI):")
    print(json.dumps(payload, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
