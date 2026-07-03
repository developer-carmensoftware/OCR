"""
Credit Card OCR Service — DB-write operations after LLM extraction.

Handles: duplicate check → CreditCard row creation → task status finalization.
"""

import itertools
import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import select

from app.config import settings
from app.database import async_session
from app.models.orm import CreditCard, OCRTask, TaskStatus
from app.models.schemas import ExtractedCreditCardData
from app.utils.bank_detect import detect_bank_code
from app.utils.date_parsing import format_doc_date, parse_doc_date
from app.utils.db_helpers import has_submitted_doc

logger = logging.getLogger(__name__)

# Processor fee invoices: per row, pay_amt (grand total incl VAT) = commis_amt
# (fee before VAT) + tax_amt (VAT), and total is always 0. The LLM frequently
# swaps or omits these fields (QA: KTC Amount↔Net, GHL Net↔Commission, SiamPay
# commission/tax missing), so we reassign deterministically from the arithmetic
# instead of trusting the prompt.
_FEE_INVOICE_CODES = {"KTC", "GHL", "PAYPAL", "SIAMPAY"}
_NO_MERCHANT_ID_CODES = {"KTC", "GHL", "SIAMPAY"}  # PayPal maps Customer ID → merchant_id
_BANK_STATEMENT_CODES = {"BAY"}  # statement layout with a TOTAL row to consume/spread

# Supported VAT rates (VAT_RATES env, see config.py). A complete document is
# trusted as printed regardless of rate; these only drive reconstruction when
# values are missing. First entry = primary rate assumed when nothing corroborates.
_VAT_RATES: tuple[float, ...] = tuple(settings.vat_rates_list)
_VAT_RATE = _VAT_RATES[0]

_AMT_FIELDS = ("pay_amt", "commis_amt", "tax_amt", "total")


def _parse_amt(v: str | None) -> float | None:
    if v is None:
        return None
    s = str(v).replace(",", "").strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _fmt_amt(x: float) -> str:
    return f"{x:,.2f}"


def _solve_fee_row(values: dict[str, float | None]) -> tuple[float, float, float] | None:
    """Resolve (grand, fee, vat) from whatever subset/assignment the LLM emitted."""
    grand0, fee0, vat0 = values["pay_amt"], values["commis_amt"], values["tax_amt"]
    # Trust the document as printed first — a reconciling (grand, fee, vat) needs
    # no rate assumption, so ANY VAT rate (7%, 10%, …) passes through untouched.
    if grand0 and fee0 and vat0 is not None and abs((fee0 + vat0) - grand0) <= 0.02:
        return grand0, fee0, vat0
    # Zero-VAT / exempt invoice: grand equals the fee as printed. Two corroborating
    # fields beat a missing (or stray) tax value — do NOT fabricate VAT from a rate.
    if grand0 and fee0 and abs(grand0 - fee0) <= 0.02:
        return grand0, fee0, 0.0

    nonzero = sorted({round(v, 2) for v in values.values() if v}, reverse=True)
    if not nonzero:
        return None

    if len(nonzero) == 1:
        # A single number can't reveal the document's rate — assume the primary one.
        v = nonzero[0]
        field = next(f for f, x in values.items() if x and round(x, 2) == v)
        if field == "tax_amt":
            fee = round(v / _VAT_RATE, 2)
            return round(fee + v, 2), fee, v
        if field == "commis_amt":
            vat = round(v * _VAT_RATE, 2)
            return round(v + vat, 2), v, vat
        vat = round(v * _VAT_RATE / (1 + _VAT_RATE), 2)  # value is the grand total
        return v, round(v - vat, 2), vat

    if len(nonzero) == 2:
        big, small = nonzero
        # commis_amt is ~90%+ of the grand total at every supported VAT rate, so a
        # small value above this ratio can't be VAT — the pair must be (grand, fee).
        if small > big * 0.2:
            return big, small, round(big - small, 2)
        # small is the VAT; is big the fee (vat = big*rate) or the grand
        # (vat = big*rate/(1+rate))? Score both readings across every supported
        # rate and take the closest fit.
        fee_err = min(abs(small - big * r) for r in _VAT_RATES)
        grand_err = min(abs(small - big * r / (1 + r)) for r in _VAT_RATES)
        if fee_err < grand_err:
            return round(big + small, 2), big, small
        return big, round(big - small, 2), small

    # 3+ distinct values (the LLM put data in a field that should be blank, e.g.
    # a nonzero `total`). Search for a (grand, fee, vat) assignment among the
    # candidates that actually reconciles (fee + vat == grand) instead of blindly
    # trusting position — with 4 values, the smallest isn't necessarily the VAT.
    candidates = nonzero[:4]
    for grand in candidates:
        rest = [v for v in candidates if v != grand]
        for fee, vat in itertools.permutations(rest, 2):
            if abs((fee + vat) - grand) <= 0.02:
                return grand, fee, vat
    # Nothing reconciles — trust the largest as grand and the smallest as vat,
    # recompute the fee (same "trust grand & vat" strategy as the 2-value branch).
    grand, vat = candidates[0], candidates[-1]
    logger.warning(
        "Fee-invoice amounts do not reconcile (%s) — trusting grand=%.2f & vat=%.2f, recomputing fee",
        {f: v for f, v in values.items() if v},
        grand,
        vat,
    )
    return grand, round(grand - vat, 2), vat


# Mirrors the LLM skip-list in llm/prompts/shared.py ROW_RULES rule 2 — the
# deterministic strip below is the safety net for when the model ignores it.
_SUMMARY_LABELS = (
    "TOTAL",
    "GRAND TOTAL",
    "NET AMOUNT",
    "รวม",
    "จำนวนเงินรวม",
    "จำนวนเงินค่าธรรมเนียม",
)


def _is_summary_row(label: str | None) -> bool:
    up = (label or "").strip().upper()
    if up.startswith("SUB"):  # "Subtotal" contains TOTAL but is not the summary line
        return False
    return any(k in up for k in _SUMMARY_LABELS)


# Withholding-tax deduction rows — the bank's own tax line, never a card row.
# Mirrors llm/prompts/shared.py ROW_RULES rule 4.
_WHT_LABELS = ("WHT", "WITHHOLDING", "ภาษีเงินได้หัก", "หัก ณ ที่จ่าย", "ภาษีถูกหัก")


def _is_wht_row(label: str | None) -> bool:
    # .upper() is a no-op on Thai, so the Thai keywords match unchanged.
    up = (label or "").strip().upper()
    return any(k in up for k in _WHT_LABELS)


def _strip_noncard_rows(extracted: ExtractedCreditCardData) -> None:
    """Keep only real card-transaction rows for plain statement banks.

    BBL/KBANK/SCB have no other normalizer, so anything the LLM leaks stays in
    `details` and double-counts in the frontend's column sums. Mirrors the three
    row-exclusion rules the prompt gives the model (llm/prompts/shared.py
    ROW_RULES), as a deterministic safety net for when it ignores them:
      - summary lines (TOTAL / รวม / NET AMOUNT — rule 2),
      - withholding-tax lines (rule 4),
      - empty rows with a 0.00 / blank gross amount (rule 3) — a real SCB
        statement lists ~35 zero card-type rows plus TOTAL / WHT / NET AMOUNT.
    A real card row always carries a non-zero pay_amt, and card-type labels
    (Visa, VSA-INT-P, …) never contain the summary/WHT keywords, so this is safe."""
    extracted.details[:] = [
        r
        for r in extracted.details
        if _parse_amt(r.pay_amt)  # non-zero gross — drops 0.00/blank rows
        and not _is_summary_row(r.transaction)
        and not _is_wht_row(r.transaction)
    ]


def _spread_footer_vat(line_rows: list, total_vat: float) -> None:
    """Split one footer VAT figure across fee line rows, proportional to each
    line's fee (commis_amt), the last row absorbing the rounding remainder. Sets
    pay_amt = fee + vat share and total = '0' per row. Rate-agnostic: the VAT is
    taken as printed on the document, never derived from an assumed rate."""
    fee_sum = sum(_parse_amt(r.commis_amt) or 0.0 for r in line_rows)
    allocated = 0.0
    for r in line_rows[:-1]:
        fee = _parse_amt(r.commis_amt) or 0.0
        vat = round(fee * total_vat / fee_sum, 2) if fee_sum > 0 else 0.0
        r.tax_amt = _fmt_amt(vat)
        r.pay_amt = _fmt_amt(round(fee + vat, 2))
        r.total = "0"
        allocated += vat
    last = line_rows[-1]
    fee = _parse_amt(last.commis_amt) or 0.0
    vat = round(total_vat - allocated, 2)
    last.tax_amt = _fmt_amt(vat)
    last.pay_amt = _fmt_amt(round(fee + vat, 2))
    last.total = "0"


def _normalize_fee_invoice(extracted: ExtractedCreditCardData, bank_code: str) -> None:
    """All processor fee invoices share one shape: N fee line items (each a fee
    Amount, with VAT never printed per line) plus a footer carrying Subtotal /
    VAT / Grand Total. The prompt emits that footer as a final summary row.

    Primary path: consume the summary row and spread its PRINTED VAT across the
    line items — works for 1 or N lines and for ANY VAT rate (the figure is read,
    not assumed). Fallback (no summary row, e.g. a legacy single row that already
    carries its own grand/fee/vat): reconcile each row on its own.
    """
    if bank_code in _NO_MERCHANT_ID_CODES:
        extracted.merchant_id = None
    rows = extracted.details
    if not rows:
        return

    summary = next((r for r in rows if _is_summary_row(r.transaction)), None)
    if summary is None and len(rows) > 1:
        # Label garbled? A row whose fee equals the sum of the others is the footer.
        for cand in rows:
            others = [_parse_amt(r.commis_amt) or 0.0 for r in rows if r is not cand]
            if others and abs((_parse_amt(cand.commis_amt) or 0.0) - sum(others)) <= 0.02:
                summary = cand
                break

    if summary is not None:
        grand, sub, vat = (
            _parse_amt(summary.pay_amt),
            _parse_amt(summary.commis_amt),
            _parse_amt(summary.tax_amt),
        )
        if vat is None and grand is not None and sub is not None:
            vat = round(grand - sub, 2)  # footer VAT = Grand − Subtotal
        line_rows = [r for r in rows if r is not summary]
        if vat is not None and vat >= 0 and line_rows:
            _spread_footer_vat(line_rows, vat)
            rows[:] = line_rows
            return
        logger.warning(
            "Fee invoice %s: summary row found but VAT unusable (grand=%s sub=%s vat=%s) — "
            "falling back to per-row solve",
            bank_code,
            summary.pay_amt,
            summary.commis_amt,
            summary.tax_amt,
        )

    # Fallback: no usable summary row — reconcile each row independently.
    for row in rows:
        solved = _solve_fee_row({f: _parse_amt(getattr(row, f)) for f in _AMT_FIELDS})
        if solved:
            grand, fee, vat = solved
            row.pay_amt = _fmt_amt(grand)
            row.commis_amt = _fmt_amt(fee)
            row.tax_amt = _fmt_amt(vat)
        row.total = "0"


def _normalize_bay_statement(extracted: ExtractedCreditCardData) -> None:
    """QA: BAY statements print VAT and NET only on the TOTAL line — per-row
    values are blank and the LLM sometimes returns the TOTAL line as a detail
    row (or grabs the WHT column as tax). Deterministic repair:

    1. Find the summary row (by label, or gross ≈ Σ other rows' gross) and
       remove it from details.
    2. Total VAT = summary gross − commission − net (immune to wrong-column
       reads); fallback to the summary row's own tax value.
    3. Spread the VAT across detail rows proportional to commission (VAT is
       levied on the fee), last row absorbing the rounding remainder.
    4. Fill per-row net = gross − commission − tax.

    OCR values already present per row are kept (compute-when-blank only).
    """
    rows = extracted.details
    if not rows:
        return

    summary = next((r for r in rows if _is_summary_row(r.transaction)), None)
    if summary is None and len(rows) > 1:
        # Label garbled? A row whose gross equals the sum of all the others is the total line.
        for cand in rows:
            others = [_parse_amt(r.pay_amt) or 0.0 for r in rows if r is not cand]
            if others and abs((_parse_amt(cand.pay_amt) or 0.0) - sum(others)) <= 0.02:
                summary = cand
                break

    total_vat: float | None = None
    if summary is not None:
        s_gross, s_commis, s_net = (
            _parse_amt(summary.pay_amt),
            _parse_amt(summary.commis_amt),
            _parse_amt(summary.total),
        )
        if s_gross is not None and s_commis is not None and s_net is not None:
            total_vat = round(s_gross - s_commis - s_net, 2)
        else:
            total_vat = _parse_amt(summary.tax_amt)
        rows[:] = [r for r in rows if r is not summary]  # identity, not value equality

    blank_tax_rows = [r for r in rows if not _parse_amt(r.tax_amt)]
    # total_vat covers ALL detail rows — subtract any tax already filled by OCR
    # before spreading the remainder across the blank ones, or the spread + the
    # pre-filled values together overshoot the document's true VAT. (Blank rows
    # contribute 0 to the sum, so no filtering is needed.)
    prefilled_vat = sum(_parse_amt(r.tax_amt) or 0.0 for r in rows)
    remaining_vat = round(total_vat - prefilled_vat, 2) if total_vat is not None else None
    if remaining_vat is not None and remaining_vat < -0.02:
        logger.warning(
            "BAY statement: pre-filled per-row VAT (%.2f) exceeds summary-derived "
            "total VAT (%.2f) — skipping VAT spread, falling back to per-row arithmetic",
            prefilled_vat,
            total_vat,
        )
    if remaining_vat and remaining_vat > 0 and blank_tax_rows:
        commis_sum = sum(_parse_amt(r.commis_amt) or 0.0 for r in blank_tax_rows)
        if commis_sum > 0:
            allocated = 0.0
            for r in blank_tax_rows[:-1]:
                share = round((_parse_amt(r.commis_amt) or 0.0) * remaining_vat / commis_sum, 2)
                r.tax_amt = _fmt_amt(share)
                allocated += share
            blank_tax_rows[-1].tax_amt = _fmt_amt(round(remaining_vat - allocated, 2))
    else:
        # No usable summary row — old per-row fallback: tax = gross − commis − net.
        for r in blank_tax_rows:
            gross, commis, net = (
                _parse_amt(r.pay_amt),
                _parse_amt(r.commis_amt),
                _parse_amt(r.total),
            )
            if gross is None or commis is None or net is None:
                continue
            computed = round(gross - commis - net, 2)
            if computed >= 0:
                r.tax_amt = _fmt_amt(computed)

    for r in rows:
        if _parse_amt(r.total):  # blank or 0 → compute (a 0 net on a statement row is never real)
            continue
        gross, commis, tax = _parse_amt(r.pay_amt), _parse_amt(r.commis_amt), _parse_amt(r.tax_amt)
        if gross is None or commis is None or tax is None:
            continue
        net = round(gross - commis - tax, 2)
        if net >= 0:
            r.total = _fmt_amt(net)


async def finalize_extraction(
    extracted: ExtractedCreditCardData,
    task_id: str,
    tenant_id: str,
    bank_code: str | None,
    carmen_user_id: str | None,
) -> ExtractedCreditCardData:
    """Duplicate check, persist CreditCard row, mark task COMPLETED. Returns updated extracted."""
    # bank_code is unknown at extract time (the frontend never passes one), so the
    # duplicate key would otherwise always compare NULL against a submitted row's
    # real bank_code and never match. Resolve it from the extracted fields — the
    # same detection the frontend uses — so the stored draft and the submit step
    # carry a consistent bank_code.
    resolved_bank_code = bank_code or detect_bank_code(
        bank_company_name=extracted.bank_company_name,
        bank_name=extracted.bank_name,
        company_name=extracted.company_name,
        doc_name=extracted.doc_name,
        raw_text=extracted.raw_text,
    )

    if resolved_bank_code and resolved_bank_code in _FEE_INVOICE_CODES:
        _normalize_fee_invoice(extracted, resolved_bank_code)
    elif resolved_bank_code in _BANK_STATEMENT_CODES:
        _normalize_bay_statement(extracted)
    else:
        # Plain statement banks (BBL/KBANK/SCB) + undetected: no normalizer of
        # their own, so drop any summary / WHT row the LLM leaked into details.
        _strip_noncard_rows(extracted)

    async with async_session() as db:
        if extracted.doc_no:
            extracted.is_duplicate = await has_submitted_doc(
                db,
                CreditCard,
                tenant_id=tenant_id,
                bank_code=resolved_bank_code,
                doc_no=extracted.doc_no,
            )

        if not extracted.is_duplicate:
            card_id = uuid.uuid4()
            parsed_date = parse_doc_date(extracted.doc_date)
            card = CreditCard(
                id=card_id,
                task_id=uuid.UUID(task_id),
                tenant_id=tenant_id,
                bank_code=resolved_bank_code or None,
                company_name=extracted.company_name,
                bank_company_name=extracted.bank_company_name,
                doc_date=parsed_date,
                doc_no=extracted.doc_no,
                branch_no=extracted.branch_no,
                submitted_at=None,
                carmen_user_id=carmen_user_id or None,
            )
            db.add(card)
            extracted.id = str(card_id)
            if parsed_date:
                extracted.doc_date = format_doc_date(parsed_date)
        else:
            extracted.id = None

        task_res = await db.execute(select(OCRTask).where(OCRTask.id == uuid.UUID(task_id)))
        task = task_res.scalar_one_or_none()
        if task:
            task.status = TaskStatus.COMPLETED  # type: ignore
            task.completed_at = datetime.now(UTC)  # type: ignore

        await db.commit()
    return extracted


async def mark_task_failed(task_id: str, exc: Exception) -> None:
    """Mark a task FAILED and record the error message."""
    logger.error("Failed to process OCR task %s: %s", task_id, exc)
    async with async_session() as db:
        task_res = await db.execute(select(OCRTask).where(OCRTask.id == uuid.UUID(task_id)))
        task = task_res.scalar_one_or_none()
        if task:
            task.status = TaskStatus.FAILED  # type: ignore
            task.error_message = str(exc)  # type: ignore
            await db.commit()
