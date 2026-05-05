"""
Tool: map_gl

LLM-powered GL account/department mapping suggestions.

Two entry points:
  suggest_fixed_fields()    — Credit card commission, Input Tax, Bank Account (always present)
  suggest_payment_types()   — Dynamic card/payment type rows (Visa, MCA, QR, etc.)

Both return ToolResult with output = {suggestions: {field_type: {dept, acc}}, source: "ai"}
"""

import logging
import traceback
from typing import Any, Dict, List

from app.config import settings
from app.llm.client import call_text_llm
from app.llm.prompts.mapping import build_fixed_fields_prompt, build_payment_types_prompt
from app.tools.base import ToolResult

logger = logging.getLogger(__name__)

TOOL_FIXED   = "suggest_gl_fixed_fields"
TOOL_PAYMENT = "suggest_gl_payment_types"

FIXED_TYPES = ["Credit card commission", "Input Tax", "Bank Account"]


# ── Internal helpers ──────────────────────────────────────────────────────────

def _filter_by_type(accounts: List[Dict], target_type: str) -> List[Dict]:
    """Return accounts whose type matches target_type; falls back to all if none match."""
    t = target_type.lower()
    filtered = [a for a in accounts if (a.get("type") or "").lower() == t]
    return filtered if filtered else accounts


def _filter_by_keywords(accounts: List[Dict], keywords: List[str], limit: int, fallback_limit: int = 30) -> List[Dict]:
    """Score accounts by keyword hits in name, return top `limit` matches.
    If fewer than fallback_limit match, pad with unmatched accounts up to limit."""
    if not accounts:
        return []
    scored, unmatched = [], []
    for acc in accounts:
        name = (acc.get("name") or "").lower()
        score = sum(1 for kw in keywords if kw in name)
        (scored if score else unmatched).append((score, acc))
    scored.sort(key=lambda x: -x[0])
    result = [acc for _, acc in scored[:limit]]
    if len(result) < fallback_limit:
        result.extend(acc for _, acc in unmatched[:limit - len(result)])
    return result


def _validate_codes(
    data: dict,
    keys: List[str],
    valid_acc: set,
    valid_dept: set,
) -> Dict[str, Dict]:
    """Validate LLM output codes exist in allowed sets; default dept=GEN when account matched.

    Accepts both `dept`/`acc` and `deptCode`/`accountCode` key shapes — Gemini
    occasionally returns the verbose form despite prompt instructions.
    """
    suggestions = {}
    for key in keys:
        mapping = data.get(key) or {}
        raw_dept = mapping.get("dept") if mapping.get("dept") is not None else mapping.get("deptCode")
        raw_acc  = mapping.get("acc")  if mapping.get("acc")  is not None else mapping.get("accountCode")
        dept = raw_dept if raw_dept in valid_dept else None
        acc  = raw_acc  if raw_acc  in valid_acc  else None
        # Default dept to GEN whenever an account was matched — bank fees / commissions
        # are typically charged to the general cost-center, and an empty dept forces the
        # user to fill it in manually for every row.
        if acc and not dept and "GEN" in valid_dept:
            dept = "GEN"
        suggestions[key] = {"dept": dept, "acc": acc}
    return suggestions


# ── Tools ─────────────────────────────────────────────────────────────────────

async def suggest_fixed_fields(
    accounts: List[Dict[str, Any]],
    departments: List[Dict[str, Any]],
) -> ToolResult:
    """
    Suggest dept/acc for Credit card commission, Input Tax, Bank Account.

    accounts / departments: list of {code, name, type?} dicts
    """
    tool_input = {"fields": FIXED_TYPES, "account_count": len(accounts), "dept_count": len(departments)}
    try:
        if not settings.openrouter_api_key:
            return ToolResult(success=True, tool=TOOL_FIXED, input=tool_input,
                              output={"suggestions": {}, "source": "ai"})

        commission_acc = _filter_by_type(accounts, "income")
        balance_acc    = _filter_by_type(accounts, "balancesheet")

        # Pre-filter by domain keywords — split per-field so we can fall back to the
        # top-ranked candidate when the LLM returns null.
        commission_filtered = _filter_by_keywords(
            commission_acc,
            ["commission", "credit card", "เครดิตการ์ด", "ค่าธรรมเนียม", "bank charge"],
            limit=40,
        )
        tax_filtered = _filter_by_keywords(
            balance_acc,
            ["input tax", "ภาษีซื้อ", "undue", "รอตัด"],
            limit=20,
        )
        bank_filtered = _filter_by_keywords(
            balance_acc,
            ["bank", "ธนาคาร", "c/a", "s/a", "กระแสรายวัน", "ออมทรัพย์", "receivable", "ลูกหนี้"],
            limit=30,
        )

        # Combine balance-sheet candidates for the prompt (dedupe, preserve rank order)
        seen: set = set()
        balance_filtered: List[Dict[str, Any]] = []
        for a in tax_filtered + bank_filtered:
            if a["code"] not in seen:
                seen.add(a["code"])
                balance_filtered.append(a)

        dept_lines           = "\n".join(f"  {d['code']} {d['name']}" for d in departments[:50])
        commission_acc_lines = "\n".join(f"  {a['code']} {a['name']}" for a in commission_filtered)
        balance_acc_lines    = "\n".join(f"  {a['code']} {a['name']}" for a in balance_filtered)

        prompt = build_fixed_fields_prompt(
            dept_lines=dept_lines,
            commission_acc_lines=commission_acc_lines,
            balance_acc_lines=balance_acc_lines,
            commission_acc_count=len(commission_filtered),
            balance_acc_count=len(balance_filtered),
        )

        data = await call_text_llm(prompt, usage_type="MAPPING_SUGGESTION")
        if data is None:
            data = {}

        if "suggestions" in data and isinstance(data["suggestions"], dict):
            data = data["suggestions"]

        valid_acc  = {a["code"] for a in accounts}
        valid_dept = {d["code"] for d in departments}
        suggestions = _validate_codes(data, FIXED_TYPES, valid_acc, valid_dept)

        # Per-field fallback — never return null; pick top-ranked pre-filtered candidate.
        # Falls back to the broader type pool if a keyword filter found nothing.
        fallback_acc = {
            "Credit card commission": (commission_filtered or commission_acc or [{}])[0].get("code"),
            "Input Tax":              (tax_filtered or balance_acc or [{}])[0].get("code"),
            "Bank Account":           (bank_filtered or balance_acc or [{}])[0].get("code"),
        }
        for field in FIXED_TYPES:
            entry = suggestions.get(field) or {}
            if not entry.get("acc") and fallback_acc[field] in valid_acc:
                suggestions[field] = {
                    "acc": fallback_acc[field],
                    "dept": "GEN" if "GEN" in valid_dept else entry.get("dept"),
                }

        logger.info(f"[{TOOL_FIXED}] completed — {len(suggestions)} fields suggested")
        return ToolResult(
            success=True,
            tool=TOOL_FIXED,
            input=tool_input,
            output={"suggestions": suggestions, "source": "ai"},
        )

    except Exception as exc:
        logger.error(f"[{TOOL_FIXED}] error: {exc}\n{traceback.format_exc()}")
        return ToolResult(
            success=True,   # graceful degradation — empty suggestions, not a hard failure
            tool=TOOL_FIXED,
            input=tool_input,
            output={"suggestions": {}, "source": "ai"},
            errors=[str(exc)],
        )


async def suggest_payment_types(
    payment_types: List[str],
    accounts: List[Dict[str, Any]],
    departments: List[Dict[str, Any]],
) -> ToolResult:
    """
    Suggest dept/acc for a dynamic list of payment types (Visa, MCA, QR, etc.).

    accounts / departments: list of {code, name, type?} dicts
    """
    tool_input = {"payment_types": payment_types, "account_count": len(accounts), "dept_count": len(departments)}
    try:
        if not settings.openrouter_api_key or not payment_types:
            return ToolResult(success=True, tool=TOOL_PAYMENT, input=tool_input,
                              output={"suggestions": {}, "source": "ai"})

        b_accounts = _filter_by_type(accounts, "balancesheet")

        # Payment types are bank receivables — pre-filter to bank/receivable accounts
        b_filtered = _filter_by_keywords(
            b_accounts,
            ["bank", "ธนาคาร", "receivable", "ลูกหนี้", "credit card", "เครดิตการ์ด",
             "settlement", "c/a", "s/a", "กระแสรายวัน", "ออมทรัพย์"],
            limit=40,
        )

        dept_lines = "\n".join(f"  {d['code']} {d['name']}" for d in departments[:50])
        acc_lines  = "\n".join(f"  {a['code']} {a['name']}" for a in b_filtered)
        types_list = "\n".join(f"  - {t}" for t in payment_types)

        prompt = build_payment_types_prompt(
            types_list=types_list,
            dept_lines=dept_lines,
            acc_lines=acc_lines,
            b_account_count=len(b_filtered),
            payment_types=payment_types,
        )

        data = await call_text_llm(prompt, usage_type="MAPPING_SUGGESTION")
        if data is None:
            data = {}

        if "suggestions" in data and isinstance(data["suggestions"], dict):
            data = data["suggestions"]

        valid_acc  = {a["code"] for a in accounts}
        valid_dept = {d["code"] for d in departments}
        suggestions = _validate_codes(data, payment_types, valid_acc, valid_dept)

        # Fallback: if LLM couldn't match (e.g. payment_type is a numeric account
        # number rather than a card-type abbreviation), default to the top-ranked
        # bank/receivable account. Falls back through b_filtered → b_accounts → any
        # account so we always emit a non-null suggestion.
        fallback_pool = b_filtered or b_accounts or accounts
        fallback_acc = fallback_pool[0]["code"] if fallback_pool else None
        if fallback_acc and fallback_acc in valid_acc:
            for key in payment_types:
                entry = suggestions.get(key) or {}
                if not entry.get("acc"):
                    suggestions[key] = {
                        "acc": fallback_acc,
                        "dept": "GEN" if "GEN" in valid_dept else entry.get("dept"),
                    }

        logger.info(f"[{TOOL_PAYMENT}] completed — {len(suggestions)}/{len(payment_types)} types suggested")
        return ToolResult(
            success=True,
            tool=TOOL_PAYMENT,
            input=tool_input,
            output={"suggestions": suggestions, "source": "ai"},
        )

    except Exception as exc:
        logger.error(f"[{TOOL_PAYMENT}] error: {exc}\n{traceback.format_exc()}")
        return ToolResult(
            success=True,   # graceful degradation
            tool=TOOL_PAYMENT,
            input=tool_input,
            output={"suggestions": {}, "source": "ai"},
            errors=[str(exc)],
        )
