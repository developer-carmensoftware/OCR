"""Prompt builders for GL account mapping suggestions."""

from typing import List


def build_fixed_fields_prompt(
    dept_lines: str,
    commission_acc_lines: str,
    balance_acc_lines: str,
    commission_acc_count: int,
    balance_acc_count: int,
) -> str:
    return f"""Map 3 bank-statement fields to Thai accounting codes. Return JSON only — no markdown.

Fields:
- Credit card commission (ค่าธรรมเนียม): Income account — matches "commission", "credit card", "bank charge", "ค่าธรรมเนียม"
- Input Tax (ภาษีบนค่าธรรมเนียม): BalanceSheet account — matches "input tax undue", "ภาษีซื้อรอตัด"
- Bank Account (ยอดรับสุทธิ): BalanceSheet account — matches "C/A", "S/A", "bank", "ธนาคาร", "กระแสรายวัน"

Departments:
{dept_lines or "  (none)"}

Credit card commission accounts (Income, {commission_acc_count}):
{commission_acc_lines or "  (none)"}

Input Tax + Bank Account accounts (BalanceSheet, {balance_acc_count}):
{balance_acc_lines or "  (none)"}

Rules: use codes exactly as listed; null if no match; dept optional.
{{"Credit card commission":{{"dept":null,"acc":null}},"Input Tax":{{"dept":null,"acc":null}},"Bank Account":{{"dept":null,"acc":null}}}}"""


def build_payment_types_prompt(
    types_list: str,
    dept_lines: str,
    acc_lines: str,
    b_account_count: int,
    payment_types: List[str],
) -> str:
    keys = ", ".join(f'"{t}"' for t in payment_types)
    return f"""Map card/payment settlement types to Thai accounting codes. Return JSON only — no markdown.

Payment types (all map to bank receivable/asset accounts):
{types_list}

VSA=Visa, MCA=Mastercard, QR-*=QR payments, -P=Premium, -INT=International, -DCC=DCC, -AFF=Affiliate

Departments:
{dept_lines or "  (none)"}

BalanceSheet accounts ({b_account_count}):
{acc_lines or "  (none)"}

Rules: use codes exactly as listed; null if no match; all types typically share the same account.
Keys must be: {keys}
{{"{payment_types[0] if payment_types else ''}":{{"dept":null,"acc":null}},...}}"""


def build_ap_expense_prompt(
    items: List[dict],
    dept_lines: str,
    expense_acc_lines: str,
    expense_acc_count: int,
    invoice_desc: str = "",
) -> str:
    items_block = "\n".join(
        f'  {i["index"]}: {i["category"]} — {i["description"]} (unit price: {i.get("unit_price", 0):.2f})'
        for i in items
    )
    keys = ", ".join(f'"{i["index"]}"' for i in items)
    template = ", ".join(f'"{i["index"]}":{{"dept":"","acc":""}}' for i in items)
    invoice_context = f"Invoice Description: {invoice_desc.strip()}\n\n" if invoice_desc.strip() else ""
    return f"""Map AP invoice expense lines to Thai accounting codes. Return JSON only — no markdown.

{invoice_context}Items (index: category — description | unit price):
{items_block}

Departments:
{dept_lines or "  (none)"}

Expense accounts ({expense_acc_count}):
{expense_acc_lines or "  (none)"}

Instructions:
- Match each item's category and description to the most suitable expense account and department.
- Always provide your best guess — never leave dept or acc empty.
- Use codes exactly as listed above.
- If truly uncertain, pick the closest match by name similarity.
Keys must be: {keys}
{{{template}}}"""
