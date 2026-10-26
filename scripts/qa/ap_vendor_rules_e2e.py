r"""CA-123 — AP vendor reading rules, at the extraction layer (real LLM, no Carmen, no credits).

    python scripts/qa/ap_vendor_rules_e2e.py fixture     # the 10-19 misread through the real postprocess
    python scripts/qa/ap_vendor_rules_e2e.py stability   # Polar Bear's invoice, PDF/PNG/JPEG x 2 models x N
    python scripts/qa/ap_vendor_rules_e2e.py regress     # old prompt vs new on every AP sample on disk

Calls `extract_ap_invoice_data` in-process — the same prompt, PDF handling, LLM client and
postprocess the `/ap-invoice/extract` route runs — but never the route, so nothing is charged
and nothing reaches Carmen. "Old prompt" is the AP prompt with rule 8 (VENDOR_RULES) cut off.

`fixture` feeds the real postprocess the reading a customer's Carmen showed (AP Seq 16462:
UNIT DETAILS, 12 x 76.32 and 10 x 38.22) and writes the response the UI test serves for its
warning-banner case (`ap_vendor_rules_ui.mjs U3`).

LLM output varies run to run, so `regress` re-runs each side twice more on any difference and
only calls it the rule's doing when the new prompt is consistently different from every old run.

Sample paths default to the user's Downloads; override with AP_SAMPLES_DIR / POLAR_BEAR_PDF.
Output lands in backend/scratch/ca123/ (gitignored). The llm_usage_logs write fails for want of
a tenant and is silenced: these calls are not a tenant's.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
from pathlib import Path
from unittest.mock import patch

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / "backend" / ".env")
sys.path.insert(0, str(ROOT / "backend"))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if "lhlncsjqxttcdegkqvid" in os.environ.get("DATABASE_URL", ""):
    sys.exit("[abort] DATABASE_URL points at PRODUCTION")
logging.disable(logging.CRITICAL)

import app.services.ap_invoice.service as svc  # noqa: E402
from app.llm.prompts.ap_invoice import PROMPT as NEW_PROMPT  # noqa: E402

OLD_PROMPT = NEW_PROMPT.split("\n\n8. กฎเฉพาะผู้ขาย")[0]
OUT = ROOT / "backend" / "scratch" / "ca123"
DOWNLOADS = Path.home() / "Downloads"
POLAR_BEAR = Path(
    os.environ.get(
        "POLAR_BEAR_PDF", DOWNLOADS / "ตัวอย่าง invoice ที่มี qty price หลาย column.pdf"
    )
)
POLAR_BEAR_TIN = "0105559082715"
MODELS = ("google/gemini-3.1-flash-lite-preview", "google/gemini-2.5-flash-lite")


def ap_samples() -> list[Path]:
    photos = Path(
        os.environ.get(
            "AP_SAMPLES_DIR",
            DOWNLOADS / "ocr invoice-20260528T081547Z-3-001" / "ocr invoice",
        )
    )
    pdfs = [
        Path.home() / "Desktop" / "demo-mock-docs" / "ap_tax_invoice.pdf",
        ROOT / "scripts" / "demo" / "out" / "manual" / "AP_manual_IV2610-0533.pdf",
        DOWNLOADS / "Invoice-IZD7X6GH-0003.pdf",
        DOWNLOADS / "NTInvoices26-05-2026-180596.pdf",
        *sorted(OUT.glob("CA-122_QA_*.pdf")),
    ]
    return [p for p in [*sorted(photos.glob("*.jpg")), *pdfs] if p.exists()]


async def extract(path: Path, prompt: str, model: str, tag: str) -> dict:
    svc.AP_INVOICE_PROMPT = prompt
    svc.settings.openrouter_ap_invoice_model = model
    try:
        return await svc.extract_ap_invoice_data(
            path.read_bytes(), path.name, task_id=f"ca123-{tag}"
        )
    except Exception as e:  # noqa: BLE001 — a failed call is a result here, not a crash
        return {"error": repr(e)[:300]}


def signature(res: dict) -> dict:
    """What a reviewer would see differ: vendor, rows and their money, totals, warnings."""
    if "error" in res:
        return {"error": res["error"]}
    return {
        "vendorTaxId": res.get("vendorTaxId"),
        "documentNumber": res.get("documentNumber"),
        "documentDate": res.get("documentDate"),
        "rows": [
            [
                round(float(i.get(k) or 0), 2)
                for k in ("qty", "unitPrice", "lineSubTotal", "taxAmt")
            ]
            for i in res.get("items", [])
        ],
        "grandTotal": res.get("grandTotal"),
        "warnings": sorted(
            w["code"] if isinstance(w, dict) else "legacy"
            for w in res.get("warnings", [])
        ),
    }


# ── fixture ───────────────────────────────────────────────────────────────────

# What the model returned on 10-19, reconstructed from the customer's Carmen (AP Seq 16462):
# UNIT DETAILS for rows 2 and 3, and row 3's Amount computed rather than read (382.20).
MISREAD = {
    "vendorName": "บริษัท โพลาร์ แบร์ มิชชั่น จำกัด",
    "vendorTaxId": POLAR_BEAR_TIN,
    "vendorBranch": "สำนักงานใหญ่",
    "documentName": "ใบกำกับภาษี/ใบส่งของ",
    "documentDate": "02/10/2026",
    "documentNumber": "INV-20260828145",
    "items": [
        {
            "description": "วิปปิ้งครีม 1 ลิตร/กล่อง",
            "qty": 5,
            "unitPrice": 148.60,
            "lineAmt": 743.00,
            "taxPct": 7,
        },
        {
            "description": "กะทิขวด 12 x 1 ลิตร/กล่อง",
            "qty": 12,
            "unitPrice": 76.32,
            "lineAmt": 915.89,
            "taxPct": 7,
        },
        {
            "description": "แป้งทอดกรอบ 10 x 1 กก./กล่อง",
            "qty": 10,
            "unitPrice": 38.22,
            "lineAmt": 382.20,
            "taxPct": 7,
        },
        {
            "description": "เฮเซลนัทบดผสมโกโก้ 3 กก./กระปุก",
            "qty": 1,
            "unitPrice": 1895.33,
            "lineAmt": 1895.33,
            "taxPct": 7,
        },
    ],
    "docSubTotal": 3936.46,
    "docDiscount": 0,
    "docTaxAmount": 275.55,
    "docGrandTotal": 4212.01,
    "depositPct": 0,
    "depositLabel": "",
}


async def _postprocessed(raw: dict) -> dict:
    """The real extract path with the model's answer fixed — no LLM call, no cost."""

    async def answer(**_kw) -> str:
        return json.dumps(raw, ensure_ascii=False)

    with patch.object(svc, "call_vision_llm", answer):
        return await svc.extract_ap_invoice_data(
            POLAR_BEAR.read_bytes(), "fixture.pdf", task_id="ca123-fixture"
        )


async def cmd_fixture(_args) -> int:
    res = await _postprocessed(MISREAD)
    warn = [w for w in res["warnings"] if w.get("code") == "apQtyPriceMismatch"]
    line_sum = round(sum(i["lineSubTotal"] for i in res["items"]), 2)

    # The PACK reading, with the warning added by hand: the one case the UI must show
    # without the totals mismatch that the misread also causes — so whether Proceed stays
    # enabled is down to the warning alone.
    pack = json.loads(json.dumps(MISREAD))
    pack["items"][1].update(qty=1, unitPrice=915.89)
    pack["items"][2].update(qty=1, unitPrice=382.24, lineAmt=382.24)
    warning_only = await _postprocessed(pack)
    warning_only["warnings"].append(
        {"code": "apQtyPriceMismatch", "params": {"lines": "2"}}
    )

    checks = {
        "apQtyPriceMismatch names line 2 only (row 3's misread Amount multiplies back)": warn
        == [{"code": "apQtyPriceMismatch", "params": {"lines": "2"}}],
        "lines sum to 3936.42, short of the printed 3936.46 (the UI's reconciliation catches row 3)": line_sum
        == 3936.42,
        "the PACK reading raises nothing of its own": len(warning_only["warnings"])
        == 1,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    for name, data in (
        ("ap_warning_fixture.json", res),
        ("ap_warning_only_fixture.json", warning_only),
    ):
        (OUT / name).write_text(
            json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8"
        )
    for name, ok in checks.items():
        print(("PASS " if ok else "FAIL ") + name)
    print(f"-> {OUT}")
    return 0 if all(checks.values()) else 1


# ── stability ─────────────────────────────────────────────────────────────────


def render_variants() -> list[Path]:
    """The invoice as uploaded three ways: the PDF, a 150-dpi PNG, a q60 JPEG (phone-like)."""
    import fitz  # PyMuPDF, already a backend dependency (utils/pdf_utils)

    OUT.mkdir(parents=True, exist_ok=True)
    pix = fitz.open(POLAR_BEAR)[0].get_pixmap(dpi=150)
    png, jpg = OUT / "polar_bear.png", OUT / "polar_bear.jpg"
    pix.save(png)
    pix.save(jpg, jpg_quality=60)
    return [POLAR_BEAR, png, jpg]


def pack_problems(res: dict) -> list[str]:
    if "error" in res:
        return [res["error"]]
    problems = []
    if res.get("vendorTaxId") != POLAR_BEAR_TIN:
        problems.append(f"vendorTaxId={res.get('vendorTaxId')}")
    # The old prompt read the "BN-7" box beside the title as the number, 6/6 (2026-10-26).
    if res.get("documentNumber") != "INV-20260828145":
        problems.append(f"documentNumber={res.get('documentNumber')}")
    items = res.get("items", [])
    for n, i in enumerate(items, 1):
        if (
            abs(float(i["qty"]) * float(i["unitPrice"]) - float(i["lineSubTotal"]))
            > 0.01
        ):
            problems.append(
                f"row {n}: {i['qty']} x {i['unitPrice']} != {i['lineSubTotal']}"
            )
    want = {"กะทิ": (1.0, 915.89), "แป้ง": (1.0, 382.24)}
    for key, (q, p) in want.items():
        row = next((i for i in items if key in (i.get("description") or "")), None)
        if row and (float(row["qty"]), float(row["unitPrice"])) != (q, p):
            problems.append(f"{key}: {row['qty']} x {row['unitPrice']}")
    if any(
        w.get("code") == "apQtyPriceMismatch"
        for w in res.get("warnings", [])
        if isinstance(w, dict)
    ):
        problems.append("apQtyPriceMismatch raised")
    if res.get("grandTotal") != 4212.01:
        problems.append(f"grandTotal={res.get('grandTotal')}")
    return problems


async def cmd_stability(args) -> int:
    failed = 0
    for model in args.models:
        for path in render_variants():
            for k in range(args.n):
                problems = pack_problems(
                    await extract(path, NEW_PROMPT, model, f"stab-{k}")
                )
                failed += bool(problems)
                print(
                    f"{'PASS' if not problems else 'FAIL'} {model.split('/')[1]:30} {path.suffix:5} #{k + 1}"
                    + (f"  {problems}" if problems else "")
                )
    print(f"\n{failed} failed of {len(args.models) * 3 * args.n}")
    return 1 if failed else 0


# ── regress ───────────────────────────────────────────────────────────────────


async def cmd_regress(args) -> int:
    files = [p for p in ap_samples() if not args.only or p.name in args.only]
    sem = asyncio.Semaphore(args.concurrency)
    model = args.models[0]

    async def one(path: Path) -> dict:
        async with sem:
            old = signature(await extract(path, OLD_PROMPT, model, "old"))
            new = signature(await extract(path, NEW_PROMPT, model, "new"))
            if old == new:
                return {"file": path.name, "verdict": "same"}
            olds = [old] + [
                signature(await extract(path, OLD_PROMPT, model, f"old{k}"))
                for k in (2, 3)
            ]
            news = [new] + [
                signature(await extract(path, NEW_PROMPT, model, f"new{k}"))
                for k in (2, 3)
            ]
            # A run that failed (OpenRouter 402/429) proves nothing either way.
            if any("error" in s for s in olds + news):
                verdict = "error"
            # The rule's doing only if every new run agrees and matches no old run at all.
            elif all(n == news[0] for n in news) and all(
                n != o for n in news for o in olds
            ):
                verdict = "RULE"
            else:
                verdict = "noise"
            return {"file": path.name, "verdict": verdict, "old": olds, "new": news}

    print(f"{len(files)} samples, model {model}, concurrency {args.concurrency}")
    results = await asyncio.gather(*(one(p) for p in files))
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / args.out).write_text(
        json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    counts = {
        v: sum(r["verdict"] == v for r in results)
        for v in ("same", "noise", "RULE", "error")
    }
    for r in results:
        if r["verdict"] != "same":
            print(f"{r['verdict']:5} {r['file']}")
    print(f"\n{counts}  -> {OUT / args.out}")
    return 1 if counts["RULE"] or counts["error"] else 0


def main() -> None:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("fixture")
    st = sub.add_parser("stability")
    st.add_argument("-n", type=int, default=5)
    st.add_argument("--models", nargs="+", default=list(MODELS))
    rg = sub.add_parser("regress")
    rg.add_argument("--concurrency", type=int, default=3)
    rg.add_argument("--models", nargs="+", default=[MODELS[0]])
    rg.add_argument(
        "--only", nargs="+", help="file names to re-run (default: every sample)"
    )
    rg.add_argument(
        "--out", default="regress.json", help="report name under backend/scratch/ca123"
    )
    args = ap.parse_args()
    cmd = {"fixture": cmd_fixture, "stability": cmd_stability, "regress": cmd_regress}[
        args.cmd
    ]
    sys.exit(asyncio.run(cmd(args)))


if __name__ == "__main__":
    main()
