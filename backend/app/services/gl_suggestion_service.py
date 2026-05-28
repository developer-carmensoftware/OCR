"""
GL Suggestion Service — LLM-powered GL account/department mapping suggestions.

Two entry points:
  suggest_fixed_fields()    — Credit card commission, Input Tax, Bank Account (always present)
  suggest_payment_types()   — Dynamic card/payment type rows (Visa, MCA, QR, etc.)

Both return ToolResult with output = {suggestions: {field_type: {dept, acc}}, source: "ai"}
"""

import logging
import traceback
from typing import Any

from app.config import settings
from app.constants import GLFields, Module
from app.llm.client import call_text_llm
from app.llm.prompts.mapping import build_fixed_fields_prompt, build_payment_types_prompt
from app.tools.base import ToolResult
from app.utils.gl_filter import score_and_pad

logger = logging.getLogger(__name__)

TOOL_FIXED = "suggest_gl_fixed_fields"
TOOL_PAYMENT = "suggest_gl_payment_types"

FIXED_TYPES = GLFields.FIXED_TYPES


# ── Internal helpers ──────────────────────────────────────────────────────────


def _filter_by_type(accounts: list[dict], target_type: str) -> list[dict]:
    """Return accounts whose type matches target_type; falls back to all if none match."""
    t = target_type.lower()
    filtered = [a for a in accounts if (a.get("type") or "").lower() == t]
    return filtered if filtered else accounts


def _filter_by_keywords(
    accounts: list[dict], keywords: list[str], limit: int, fallback_limit: int = 30
) -> list[dict]:
    return score_and_pad(accounts, keywords, limit, pad_threshold=fallback_limit)


def _validate_codes(
    data: dict,
    keys: list[str],
    valid_acc: set,
    valid_dept: set,
) -> dict[str, dict]:
    """Validate LLM output codes exist in allowed sets; default dept=GEN when account matched.

    Accepts both `dept`/`acc` and `deptCode`/`accountCode` key shapes — Gemini
    occasionally returns the verbose form despite prompt instructions.
    """
    suggestions = {}
    for key in keys:
        mapping = data.get(key) or {}
        raw_dept = (
            mapping.get("dept") if mapping.get("dept") is not None else mapping.get("deptCode")
        )
        raw_acc = (
            mapping.get("acc") if mapping.get("acc") is not None else mapping.get("accountCode")
        )
        dept = raw_dept if raw_dept in valid_dept else None
        acc = raw_acc if raw_acc in valid_acc else None
        if acc and not dept and "GEN" in valid_dept:
            dept = "GEN"
        suggestions[key] = {"dept": dept, "acc": acc}
    return suggestions


# ── Public functions ───────────────────────────────────────────────────────────


async def suggest_fixed_fields(
    accounts: list[dict[str, Any]],
    departments: list[dict[str, Any]],
    hint_text: str = "",
) -> ToolResult:
    """
    Suggest dept/acc for Credit card commission, Input Tax, Bank Account.

    accounts / departments: list of {code, name, type?} dicts
    """
    tool_input = {
        "fields": FIXED_TYPES,
        "account_count": len(accounts),
        "dept_count": len(departments),
    }
    try:
        if not settings.openrouter_api_key:
            return ToolResult(
                success=True,
                tool=TOOL_FIXED,
                input=tool_input,
                output={"suggestions": {}, "source": "ai"},
            )

        commission_acc = _filter_by_type(accounts, "income")
        balance_acc = _filter_by_type(accounts, "balancesheet")

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

        seen: set = set()
        balance_filtered: list[dict[str, Any]] = []
        for a in tax_filtered + bank_filtered:
            if a["code"] not in seen:
                seen.add(a["code"])
                balance_filtered.append(a)

        dept_lines = "\n".join(f"  {d['code']} {d['name']}" for d in departments[:50])
        commission_acc_lines = "\n".join(f"  {a['code']} {a['name']}" for a in commission_filtered)
        balance_acc_lines = "\n".join(f"  {a['code']} {a['name']}" for a in balance_filtered)

        prompt = build_fixed_fields_prompt(
            dept_lines=dept_lines,
            commission_acc_lines=commission_acc_lines,
            balance_acc_lines=balance_acc_lines,
            commission_acc_count=len(commission_filtered),
            balance_acc_count=len(balance_filtered),
            hint_text=hint_text,
        )

        data = await call_text_llm(prompt, module_id=Module.CREDIT_CARD_OCR)
        if data is None:
            data = {}

        if "suggestions" in data and isinstance(data["suggestions"], dict):
            data = data["suggestions"]

        valid_acc = {a["code"] for a in accounts}
        valid_dept = {d["code"] for d in departments}
        suggestions = _validate_codes(data, FIXED_TYPES, valid_acc, valid_dept)

        fallback_acc = {
            "Credit card commission": (commission_filtered or commission_acc or [{}])[0].get(
                "code"
            ),
            "Input Tax": (tax_filtered or balance_acc or [{}])[0].get("code"),
            "Bank Account": (bank_filtered or balance_acc or [{}])[0].get("code"),
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
            success=True,
            tool=TOOL_FIXED,
            input=tool_input,
            output={"suggestions": {}, "source": "ai"},
            errors=[str(exc)],
        )


async def suggest_payment_types(
    payment_types: list[str],
    accounts: list[dict[str, Any]],
    departments: list[dict[str, Any]],
    hint_text: str = "",
) -> ToolResult:
    """
    Suggest dept/acc for a dynamic list of payment types (Visa, MCA, QR, etc.).

    accounts / departments: list of {code, name, type?} dicts
    """
    tool_input = {
        "payment_types": payment_types,
        "account_count": len(accounts),
        "dept_count": len(departments),
    }
    try:
        if not settings.openrouter_api_key or not payment_types:
            return ToolResult(
                success=True,
                tool=TOOL_PAYMENT,
                input=tool_input,
                output={"suggestions": {}, "source": "ai"},
            )

        b_accounts = _filter_by_type(accounts, "balancesheet")

        b_filtered = _filter_by_keywords(
            b_accounts,
            [
                "bank",
                "ธนาคาร",
                "receivable",
                "ลูกหนี้",
                "credit card",
                "เครดิตการ์ด",
                "settlement",
                "c/a",
                "s/a",
                "กระแสรายวัน",
                "ออมทรัพย์",
            ],
            limit=40,
        )

        dept_lines = "\n".join(f"  {d['code']} {d['name']}" for d in departments[:50])
        acc_lines = "\n".join(f"  {a['code']} {a['name']}" for a in b_filtered)
        types_list = "\n".join(f"  - {t}" for t in payment_types)

        prompt = build_payment_types_prompt(
            types_list=types_list,
            dept_lines=dept_lines,
            acc_lines=acc_lines,
            b_account_count=len(b_filtered),
            payment_types=payment_types,
            hint_text=hint_text,
        )

        data = await call_text_llm(prompt, module_id=Module.CREDIT_CARD_OCR)
        if data is None:
            data = {}

        if "suggestions" in data and isinstance(data["suggestions"], dict):
            data = data["suggestions"]

        valid_acc = {a["code"] for a in accounts}
        valid_dept = {d["code"] for d in departments}
        suggestions = _validate_codes(data, payment_types, valid_acc, valid_dept)

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

        logger.info(
            f"[{TOOL_PAYMENT}] completed — {len(suggestions)}/{len(payment_types)} types suggested"
        )
        return ToolResult(
            success=True,
            tool=TOOL_PAYMENT,
            input=tool_input,
            output={"suggestions": suggestions, "source": "ai"},
        )

    except Exception as exc:
        logger.error(f"[{TOOL_PAYMENT}] error: {exc}\n{traceback.format_exc()}")
        return ToolResult(
            success=True,
            tool=TOOL_PAYMENT,
            input=tool_input,
            output={"suggestions": {}, "source": "ai"},
            errors=[str(exc)],
        )
