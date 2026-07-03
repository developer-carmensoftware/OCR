"""
Credit Card OCR Service — DB-write operations after LLM extraction.

Handles: duplicate check → CreditCard row creation → task status finalization.
"""

import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import select

from app.database import async_session
from app.models.orm import CreditCard, OCRTask, TaskStatus
from app.models.schemas import ExtractedCreditCardData
from app.utils.bank_detect import detect_bank_code
from app.utils.date_parsing import parse_doc_date
from app.utils.db_helpers import has_submitted_doc

logger = logging.getLogger(__name__)

# Processor fee invoices: per row, pay_amt (grand total incl VAT) = commis_amt
# (fee before VAT) + tax_amt (VAT 7%), and total is always 0. The LLM frequently
# swaps or omits these fields (QA: KTC Amount↔Net, GHL Net↔Commission, SiamPay
# commission/tax missing), so we reassign deterministically from the arithmetic
# instead of trusting the prompt.
_FEE_INVOICE_CODES = {"KTC", "GHL", "PAYPAL", "SIAMPAY"}
_NO_MERCHANT_ID_CODES = {"KTC", "GHL", "SIAMPAY"}  # PayPal maps Customer ID → merchant_id
_VAT_RATE = 0.07

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
    nonzero = sorted({round(v, 2) for v in values.values() if v}, reverse=True)
    if not nonzero:
        return None

    if len(nonzero) == 1:
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
        if small > big * 0.2:  # pair is (grand, fee) — vat would be ≲7% of grand
            return big, small, round(big - small, 2)
        # small is the VAT; is big the fee (vat = big*7%) or the grand (vat = big*7/107)?
        if abs(small - big * _VAT_RATE) < abs(small - big * _VAT_RATE / (1 + _VAT_RATE)):
            return round(big + small, 2), big, small
        return big, round(big - small, 2), small

    grand, fee, vat = nonzero[0], nonzero[1], nonzero[-1]
    if abs((fee + vat) - grand) > 0.02:  # inconsistent middle value — trust grand & vat
        fee = round(grand - vat, 2)
    return grand, fee, vat


def _normalize_fee_invoice(extracted: ExtractedCreditCardData, bank_code: str) -> None:
    if bank_code in _NO_MERCHANT_ID_CODES:
        extracted.merchant_id = None
    for row in extracted.details:
        solved = _solve_fee_row({f: _parse_amt(getattr(row, f)) for f in _AMT_FIELDS})
        if solved:
            grand, fee, vat = solved
            row.pay_amt = _fmt_amt(grand)
            row.commis_amt = _fmt_amt(fee)
            row.tax_amt = _fmt_amt(vat)
        row.total = "0"


_SUMMARY_LABELS = ("TOTAL", "GRAND TOTAL", "รวม", "จำนวนเงินรวม")


def _is_summary_row(label: str | None) -> bool:
    up = (label or "").strip().upper()
    return any(k in up for k in _SUMMARY_LABELS)


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
        rows.remove(summary)

    blank_tax_rows = [r for r in rows if not _parse_amt(r.tax_amt)]
    if total_vat and total_vat > 0 and blank_tax_rows:
        commis_sum = sum(_parse_amt(r.commis_amt) or 0.0 for r in blank_tax_rows)
        if commis_sum > 0:
            allocated = 0.0
            for r in blank_tax_rows[:-1]:
                share = round((_parse_amt(r.commis_amt) or 0.0) * total_vat / commis_sum, 2)
                r.tax_amt = _fmt_amt(share)
                allocated += share
            blank_tax_rows[-1].tax_amt = _fmt_amt(round(total_vat - allocated, 2))
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

    if resolved_bank_code in _FEE_INVOICE_CODES:
        _normalize_fee_invoice(extracted, resolved_bank_code)
    elif resolved_bank_code == "BAY":
        _normalize_bay_statement(extracted)

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
                from app.utils.date_parsing import format_doc_date

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
