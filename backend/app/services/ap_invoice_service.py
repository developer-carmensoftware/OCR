import asyncio
import base64
import functools
import json
import logging
import os
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.constants import ExpenseAccounts, Module
from app.exceptions import LLMParseError, ValidationError
from app.llm.client import _strip_code_fences, call_text_llm, call_vision_llm
from app.llm.prompts.ap_invoice import PROMPT as AP_INVOICE_PROMPT
from app.llm.prompts.mapping import build_ap_expense_prompt
from app.services.ap_invoice_postprocess_service import postprocess as postprocess_ap_invoice
from app.services.ap_vendor_history_service import (
    aggregate_history,
    fetch_vendor_history,
    format_history_for_prompt,
    match_bypass,
    select_examples,
)
from app.utils.gl_filter import score_and_pad
from app.utils.image_processing import resize_if_needed
from app.utils.pdf_utils import (
    MAX_PAGES_PER_CALL,
    PDF_RENDER_TIMEOUT_SECONDS,
    extract_pages_as_pdf,
    get_pdf_page_count,
    normalize_pdf_for_llm,
)

logger = logging.getLogger(__name__)

# Category → search keywords for pre-filtering expense accounts
_CATEGORY_KW: dict[str, list[str]] = {
    "ค่าบริการ": ["บริการ", "service", "fee", "ค่าจ้าง", "ที่ปรึกษา", "professional", "consultant"],
    "ซอฟต์แวร์": [
        "software",
        "ซอฟต์แวร์",
        "it",
        "ไอที",
        "license",
        "program",
        "subscription",
        "saas",
        "โปรแกรม",
    ],
    "อุปกรณ์ไอที": ["it", "computer", "อุปกรณ์", "equipment", "ไอที", "hardware", "server", "network"],
    "วัสดุสำนักงาน": ["วัสดุ", "สำนักงาน", "office", "stationery", "เครื่องเขียน", "supplies"],
    "ค่าโฆษณา": ["โฆษณา", "advertis", "marketing", "promotion", "สื่อ", "media"],
    "ค่าขนส่ง": ["ขนส่ง", "transport", "delivery", "freight", "logistic", "ค่าส่ง", "shipping"],
    "ค่าเช่า": ["เช่า", "rent", "lease", "rental"],
    "วัตถุดิบ": ["วัตถุดิบ", "raw material", "material", "ingredient"],
    "บรรจุภัณฑ์": ["บรรจุ", "packaging", "package", "กล่อง", "ถุง", "ฉลาก", "label"],
    "ยา-เวชภัณฑ์": ["ยา", "เวชภัณฑ์", "medical", "pharma", "medicine", "hospital"],
    "เงินมัดจำ": ["มัดจำ", "deposit", "advance", "installment"],
    # New categories matching expanded OCR prompt
    "ค่าสาธารณูปโภค": [
        "ไฟฟ้า",
        "electricity",
        "น้ำประปา",
        "water",
        "โทรศัพท์",
        "telephone",
        "internet",
        "utility",
        "สาธารณูปโภค",
        "ค่าไฟ",
        "ค่าน้ำ",
    ],
    "ค่าซ่อมบำรุง": ["ซ่อม", "repair", "maintenance", "บำรุง", "บำรุงรักษา", "ซ่อมแซม", "fix"],
    "ค่าประกันภัย": ["ประกัน", "insurance", "premium", "ประกันภัย", "อัคคีภัย"],
    "เบี้ยปรับ": ["ปรับ", "penalty", "fine", "เบี้ยปรับ", "liquidated", "ค่าปรับ"],
    "สินทรัพย์": [
        "สินทรัพย์",
        "asset",
        "fixed asset",
        "ครุภัณฑ์",
        "เครื่องจักร",
        "ยานพาหนะ",
        "vehicle",
        "machine",
    ],
}


def _filter_expense_accounts(
    accounts: list[dict], items: list[dict], max_acc: int = 100, invoice_desc: str = ""
) -> list[dict]:
    """Return the most relevant expense accounts by keyword-scoring against
    category + description + invoice_desc. Falls back to the first `max_acc` when nothing matches."""
    if not accounts:
        return []
    keywords: set[str] = set()
    for item in items:
        cat = (item.get("category") or "").lower()
        desc = (item.get("description") or "").lower()
        for cat_key, kws in _CATEGORY_KW.items():
            if cat_key in cat or any(kw in cat for kw in kws):
                keywords.update(kws)
        keywords.update(w for w in desc.split() if len(w) >= 3)
    if invoice_desc:
        keywords.update(w.lower() for w in invoice_desc.split() if len(w) >= 3)

    if not keywords:
        return accounts[:max_acc]

    return score_and_pad(accounts, keywords, max_acc)


async def extract_ap_invoice_data(
    file_bytes: bytes,
    filename: str,
    task_id: str,
    selected_pages: list[int] | None = None,
    pdf_password: str | None = None,
) -> dict[str, Any]:
    """Extract AP Invoice details using Vision LLM.

    For multi-page PDFs, the rendered pages are sent in a single LLM call so the
    model can correlate header/footer/line data across pages. ``selected_pages``
    (0-based) restricts which pages are sent; None → all pages.
    ``pdf_password`` unlocks an encrypted PDF (None = not encrypted).
    """
    ap_model = settings.openrouter_ap_invoice_model or settings.openrouter_ocr_model
    ext = os.path.splitext(filename)[1].lower()

    if ext == ".pdf":
        # Page selection sends a native PDF subset (full vector/text fidelity); no
        # selection sends the whole PDF natively. Rasterising to PNG degraded dense
        # tables and broke extraction, so we keep the document in PDF form.
        if selected_pages:
            page_count = await asyncio.get_running_loop().run_in_executor(
                None, functools.partial(get_pdf_page_count, file_bytes, pdf_password)
            )
            valid_pages = [p for p in selected_pages if 0 <= p < page_count]
            if not valid_pages:
                raise ValidationError(
                    f"selected_pages {selected_pages} are out of range for a "
                    f"{page_count}-page document."
                )
            try:
                pdf_bytes = await asyncio.wait_for(
                    asyncio.get_running_loop().run_in_executor(
                        None,
                        functools.partial(
                            extract_pages_as_pdf, file_bytes, valid_pages, pdf_password
                        ),
                    ),
                    timeout=PDF_RENDER_TIMEOUT_SECONDS,
                )
            except TimeoutError as exc:
                raise ValidationError(
                    "PDF processing timed out — the file may be malformed."
                ) from exc
        else:
            # No selection → whole PDF natively, but never exceed MAX_PAGES_PER_CALL.
            # An unbounded page count is both a token-cost/DoS vector and a likely
            # context-overflow LLM failure; the pages-cap invariant (utils/pages.py)
            # must hold on this path too, not only the explicit-selection path. Over
            # the cap, send the first MAX_PAGES_PER_CALL pages natively.
            page_count = await asyncio.get_running_loop().run_in_executor(
                None, functools.partial(get_pdf_page_count, file_bytes, pdf_password)
            )
            if page_count > MAX_PAGES_PER_CALL:
                logger.warning(
                    "AP invoice %s has %d pages; capping to first %d for extraction",
                    filename,
                    page_count,
                    MAX_PAGES_PER_CALL,
                )
                pdf_bytes = await asyncio.wait_for(
                    asyncio.get_running_loop().run_in_executor(
                        None,
                        functools.partial(
                            extract_pages_as_pdf,
                            file_bytes,
                            list(range(MAX_PAGES_PER_CALL)),
                            pdf_password,
                        ),
                    ),
                    timeout=PDF_RENDER_TIMEOUT_SECONDS,
                )
            else:
                # Within the cap → decrypt only if encrypted so the provider doesn't
                # reject it as "The document has no pages."
                pdf_bytes = await asyncio.get_running_loop().run_in_executor(
                    None, functools.partial(normalize_pdf_for_llm, file_bytes, pdf_password)
                )
        image_items = [
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:application/pdf;base64,{base64.b64encode(pdf_bytes).decode()}"
                },
            }
        ]
        total_bytes = len(pdf_bytes)
        logger.info(
            "Extracting AP Invoice: %s (model: %s, selected_pages: %s)",
            filename,
            ap_model,
            selected_pages,
        )
    else:
        processed_bytes, mime_type = await asyncio.get_running_loop().run_in_executor(
            None, functools.partial(resize_if_needed, file_bytes)
        )
        image_items = [
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:{mime_type};base64,{base64.b64encode(processed_bytes).decode()}"
                },
            }
        ]
        total_bytes = len(processed_bytes)
        logger.info("Extracting AP Invoice: %s (model: %s)", filename, ap_model)

    result_text = await call_vision_llm(
        system_prompt=AP_INVOICE_PROMPT,
        user_content=[
            *image_items,
            {"type": "text", "text": "Extract details and return JSON."},
        ],
        model=ap_model,
        task_id=task_id,
        module_id=Module.AP_INVOICE,
        image_size_bytes=total_bytes,
        count_quota=True,
    )

    result_text = _strip_code_fences(result_text)

    try:
        data = json.loads(result_text)
    except json.JSONDecodeError as exc:
        logger.error("AP JSON parse failed (%s). Raw: %.500s", exc, result_text)
        raise LLMParseError() from exc

    if isinstance(data, list):  # LLM sometimes wraps the object in a one-element array
        data = data[0] if data else {}

    return postprocess_ap_invoice(data)


def _parse_default_account(raw: Any) -> set[str]:
    """Carmen DefaultAccount is a *stringified* JSON array of {AccCode, Description}.

    Empty/absent/unparseable ⇒ empty set = no restriction (all accounts allowed).
    """
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except (ValueError, TypeError):
            return set()
    if not isinstance(raw, list):
        return set()
    return {e["AccCode"] for e in raw if isinstance(e, dict) and e.get("AccCode")}


async def suggest_for_items(
    items_payload: list[dict[str, Any]],
    accounts_raw: dict[str, Any],
    depts_raw: dict[str, Any],
    invoice_desc: str = "",
    vn_code: str = "",
    carmen_token: str = "",
) -> tuple[dict[int, dict[str, Any]], bool]:
    """AI-suggest dept/acc for AP invoice expense items.

    When `vn_code` + `carmen_token` are supplied, the vendor's Carmen invoice
    history is used to: (1) bypass the LLM for items whose normalized
    description matches a prior line, and (2) inject few-shot examples for the
    LLM call on remaining items.
    """

    accounts = [
        {
            "code": a["AccCode"],
            "name": a.get("Description") or "",
            "type": (a.get("Type") or "").lower(),
        }
        for a in (accounts_raw.get("Data") or [])
        if a.get("AccCode") and a.get("AccCode") != "AccCode"
    ]
    departments = [
        {
            "code": d["DeptCode"],
            "name": d.get("Description") or "",
            "allowed": _parse_default_account(d.get("DefaultAccount")),
        }
        for d in (depts_raw.get("Data") or [])
        if d.get("DeptCode") and d.get("DeptCode") != "CodeDep"
    ]
    # dept → AccCodes it restricts to (Carmen DefaultAccount); absent = all allowed
    dept_allowed = {d["code"]: d["allowed"] for d in departments if d["allowed"]}

    def _enforce(sugg: dict[int, dict]) -> dict[int, dict]:
        """Drop accounts illegal for their dept — user re-picks from the dept-filtered UI."""
        for entry in sugg.values():
            allowed = dept_allowed.get(entry.get("deptCode"))
            if allowed and entry.get("accountCode") not in allowed:
                entry["accountCode"] = None
        return sugg

    # Prefer accounts that match BOTH type AND prefix; fall back to prefix-only,
    # then type-only, then all accounts — avoids including asset/prepaid (1xxxxx)
    # accounts when Carmen returns type="e" for non-expense account categories.
    expense_accounts = (
        [
            a
            for a in accounts
            if a["type"] in ExpenseAccounts.VALID_TYPES
            and str(a["code"]).startswith(ExpenseAccounts.CODE_PREFIXES)
        ]
        or [a for a in accounts if str(a["code"]).startswith(ExpenseAccounts.CODE_PREFIXES)]
        or [a for a in accounts if a["type"] in ExpenseAccounts.VALID_TYPES]
        or accounts
    )

    valid_acc_map = {str(a["code"]).strip(): a["code"] for a in accounts}
    valid_dept_map = {str(d["code"]).strip(): d["code"] for d in departments}
    expense_acc_codes = {str(a["code"]).strip() for a in expense_accounts}

    # ─── Vendor history: bypass exact matches, gather few-shot examples ───
    # expense_acc_codes (not valid_acc_codes) gates both bypass and examples
    # to prevent input-tax / balance-sheet accounts from history leaking in.
    aggregate: dict[str, dict] = {}
    bypassed: dict[int, dict] = {}
    remaining_items = items_payload
    if vn_code and carmen_token:
        history_rows = await fetch_vendor_history(vn_code, carmen_token)
        if history_rows:
            aggregate = aggregate_history(history_rows)
            bypassed, remaining_items = match_bypass(
                items_payload,
                aggregate,
                valid_dept_codes=set(valid_dept_map.keys()),
                expense_acc_codes=expense_acc_codes,
            )
            logger.info(
                "Vendor history (%s): %d/%d items bypassed LLM",
                vn_code,
                len(bypassed),
                len(items_payload),
            )

    if not remaining_items:
        return _enforce(bypassed), True

    # Pre-filter expense accounts using remaining items' keywords
    filtered_accounts = _filter_expense_accounts(
        expense_accounts, remaining_items, invoice_desc=invoice_desc
    )

    dept_lines = "\n".join(f"  {d['code']} {d['name']}" for d in departments)
    expense_acc_lines = "\n".join(f"  {a['code']} {a['name']}" for a in filtered_accounts)

    vendor_history_lines = ""
    if aggregate:
        examples = select_examples(remaining_items, aggregate, expense_acc_codes=expense_acc_codes)
        vendor_history_lines = format_history_for_prompt(examples)

    prompt = build_ap_expense_prompt(
        items=remaining_items,
        dept_lines=dept_lines,
        expense_acc_lines=expense_acc_lines,
        expense_acc_count=len(filtered_accounts),
        invoice_desc=invoice_desc,
        vendor_history_lines=vendor_history_lines,
    )

    data = await call_text_llm(prompt, module_id=Module.AP_INVOICE, max_tokens=4096)
    if data is None:
        logger.warning("AP invoice suggest LLM returned None — returning bypass-only results")
        return _enforce(bypassed), False

    def _resolve(raw, valid_map: dict):
        """Match LLM-returned code against valid_map.
        Falls back to first whitespace-delimited token so codes like
        '302 Transportation' or '6030004 — Oil Filter' still resolve."""
        if raw is None:
            return None
        s = str(raw).strip()
        if s in valid_map:
            return valid_map[s]
        first = s.split()[0].rstrip(":,;-—") if s else ""
        return valid_map.get(first)

    # Unwrap if LLM nested it under "suggestions"
    if "suggestions" in data and isinstance(data["suggestions"], dict):
        data = data["suggestions"]

    suggestions: dict[int, dict] = dict(bypassed)
    for item in remaining_items:
        key = str(item["index"])
        mapping = data.get(key) or data.get(item["index"]) or {}

        raw_dept = (
            mapping.get("dept") if mapping.get("dept") is not None else mapping.get("deptCode")
        )
        raw_acc = (
            mapping.get("acc") if mapping.get("acc") is not None else mapping.get("accountCode")
        )

        dept = _resolve(raw_dept, valid_dept_map)
        acc = _resolve(raw_acc, valid_acc_map)
        suggestions[item["index"]] = {"deptCode": dept, "accountCode": acc}

    return _enforce(suggestions), True


async def mark_invoice_submitted(db: "AsyncSession", ap_invoice_id: str, tenant_id: str) -> None:
    """Mark an AP Invoice as submitted (set submitted_at = now).

    The lookup is tenant-scoped: an invoice id belonging to another tenant must
    never match, otherwise a caller could flip another tenant's submit state (IDOR).
    """
    import uuid
    from datetime import UTC, datetime

    from sqlalchemy import select

    from app.models.orm import APInvoice

    try:
        inv_uuid = uuid.UUID(ap_invoice_id)
        tenant_uuid = uuid.UUID(tenant_id)
    except (ValueError, AttributeError):
        logger.warning(
            "Skipping AP submit bookkeeping: bad ap_invoice_id=%r / tenant_id=%r",
            ap_invoice_id,
            tenant_id,
        )
        return

    result = await db.execute(
        select(APInvoice).where(
            APInvoice.id == inv_uuid,
            APInvoice.tenant_id == tenant_uuid,
            APInvoice.deleted_at.is_(None),
        )
    )
    inv = result.scalar_one_or_none()
    if inv:
        inv.submitted_at = datetime.now(UTC)  # type: ignore[assignment]
        await db.commit()
        logger.info("Marked AP Invoice %s as submitted", ap_invoice_id)
