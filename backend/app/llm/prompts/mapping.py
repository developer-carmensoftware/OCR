"""Prompt builders for GL account mapping suggestions."""

from app.utils.prompt_safety import sanitize_prompt_text


def build_fixed_fields_prompt(
    dept_lines: str,
    commission_acc_lines: str,
    balance_acc_lines: str,
    commission_acc_count: int,
    balance_acc_count: int,
    hint_text: str = "",
) -> str:
    history_section = (
        f"Prior confirmed mappings for this tenant (use as strong hints):\n{hint_text}\n\n"
        if hint_text.strip()
        else ""
    )
    return f"""You are a Thai accounting assistant. Map 3 credit card bank-statement fields to accounting codes. Return JSON only — no markdown.

Journal Entry context (Credit Card bank receipt):
  Dr Bank Account (ยอดรับสุทธิ)          ← BalanceSheet: cash/bank account (Normal Balance: Debit)
  Dr Credit card commission (ค่าธรรมเนียม) ← Expense: bank fee account (Normal Balance: Debit)
  Dr Input Tax (ภาษีซื้อ)                 ← BalanceSheet: input VAT receivable (Normal Balance: Debit)
  Cr Revenue / Accounts Receivable        (handled by the system — do NOT select)

Fields to map:
- Credit card commission (ค่าธรรมเนียมธนาคาร): Expense account — ค่าธรรมเนียมธนาคาร, bank charge, credit card fee, ค่าธรรมเนียม
- Input Tax (ภาษีซื้อบนค่าธรรมเนียม): BalanceSheet account — input tax undue, ภาษีซื้อรอตัดบัญชี, ภาษีซื้อ
- Bank Account (ยอดรับสุทธิจากธนาคาร): BalanceSheet account — C/A, S/A, bank, ธนาคาร, กระแสรายวัน, ออมทรัพย์

Departments:
{dept_lines or "  (none)"}

Credit card commission accounts (Expense, {commission_acc_count}):
{commission_acc_lines or "  (none)"}

Input Tax + Bank Account accounts (BalanceSheet, {balance_acc_count}):
{balance_acc_lines or "  (none)"}

{history_section}Rules: use codes exactly as listed; null if no match; dept optional.
{{"Credit card commission":{{"dept":null,"acc":null}},"Input Tax":{{"dept":null,"acc":null}},"Bank Account":{{"dept":null,"acc":null}}}}"""


def build_payment_types_prompt(
    types_list: str,
    dept_lines: str,
    acc_lines: str,
    b_account_count: int,
    payment_types: list[str],
    hint_text: str = "",
) -> str:
    keys = ", ".join(f'"{t}"' for t in payment_types)
    history_section = (
        f"Prior confirmed mappings for this tenant (use as strong hints):\n{hint_text}\n\n"
        if hint_text.strip()
        else ""
    )
    return f"""You are a Thai accounting assistant. Map card/payment settlement types to accounting codes. Return JSON only — no markdown.

Journal Entry context (each payment type is a receivable from the bank):
  Dr [Payment Type Account] ← BalanceSheet: bank receivable / cash account (Normal Balance: Debit)
  Cr Revenue                (handled by the system — do NOT select)

Payment types to map (each represents a bank settlement channel):
{types_list}

Payment type codes: VSA=Visa, MCA=Mastercard, QR-*=QR payments, -P=Premium, -INT=International, -DCC=DCC, -AFF=Affiliate
All types typically map to the same bank receivable / C/A account — they represent money the bank owes the merchant.

Departments:
{dept_lines or "  (none)"}

BalanceSheet accounts (bank/receivable, {b_account_count}):
{acc_lines or "  (none)"}

{history_section}Rules: use codes exactly as listed; null if no match; all types typically share the same account.
Keys must be: {keys}
{{"{payment_types[0] if payment_types else ""}":{{"dept":null,"acc":null}},...}}"""


def build_ap_expense_prompt(
    items: list[dict],
    dept_lines: str,
    expense_acc_lines: str,
    expense_acc_count: int,
    invoice_desc: str = "",
    vendor_history_lines: str = "",
) -> str:
    # category/description/invoice_desc are OCR-derived (untrusted) — sanitise to
    # prevent prompt injection before interpolation.
    items_block = "\n".join(
        f"  {i['index']}: {sanitize_prompt_text(i['category'])} — "
        f"{sanitize_prompt_text(i['description'])} (unit price: {i.get('unit_price', 0):.2f})"
        for i in items
    )
    keys = ", ".join(f'"{i["index"]}"' for i in items)
    template = ", ".join(f'"{i["index"]}":{{"dept":"","acc":""}}' for i in items)
    _invoice_desc_clean = sanitize_prompt_text(invoice_desc)
    invoice_context = (
        f"Invoice Description: {_invoice_desc_clean}\n\n" if _invoice_desc_clean else ""
    )
    history_section = (
        f"Vendor history (this vendor's prior confirmed mappings — strongly prefer these when description is similar):\n{vendor_history_lines}\n\n"
        if vendor_history_lines.strip()
        else ""
    )
    return f"""You are an AP accounting assistant. Map each AP invoice line item to the correct Thai expense account and department. Return JSON only — no markdown.

Accounting context (AP Invoice Journal Entry):
  Dr [Expense Account]   ← YOU choose this (the accounts listed below)
  Dr Input Tax (if applicable, handled separately)
  Cr Accounts Payable    (handled by the system — do NOT select this)

Account selection rules:
- ONLY choose from the expense accounts listed below (pre-filtered for you).
- These accounts have Normal Balance = Debit (ค่าใช้จ่าย / ต้นทุน).
- DO NOT choose asset (สินทรัพย์), liability (หนี้สิน), equity (ส่วนของผู้ถือหุ้น), or revenue (รายได้) accounts.
- Account code prefixes: 5xxxxx = Cost of Sales (ต้นทุนขาย), 6xxxxx = Selling Expense (ค่าใช้จ่ายในการขาย), 7xxxxx = Admin/General Expense (ค่าใช้จ่ายบริหาร).

Thai accounting naming conventions (use to match description → account):
- ค่าบริการ / Service Fee / Professional Fee / ค่าจ้าง → look for "บริการ", "service", "fee", "จ้าง", "ที่ปรึกษา"
- ซอฟต์แวร์ / Software / License / SaaS → look for "software", "license", "subscription", "ซอฟต์แวร์", "โปรแกรม"
- วัสดุสำนักงาน / Office Supplies / Stationery → look for "วัสดุ", "stationery", "office supply", "เครื่องเขียน"
- ค่าสาธารณูปโภค / Utility → look for "ค่าไฟ", "ไฟฟ้า", "electricity", "น้ำประปา", "water", "โทรศัพท์", "telephone", "internet"
- ค่าซ่อมบำรุง / Repair & Maintenance → look for "ซ่อม", "repair", "maintenance", "บำรุง"
- ค่าประกันภัย / Insurance → look for "ประกัน", "insurance", "premium"
- ค่าขนส่ง / Freight / Delivery → look for "ขนส่ง", "freight", "delivery", "logistic", "ค่าส่ง"
- ค่าโฆษณา / Advertising / Marketing → look for "โฆษณา", "advertis", "marketing", "promotion"
- ค่าเช่า / Rental / Lease → look for "เช่า", "rent", "lease"
- เบี้ยปรับ / Penalty → look for "ปรับ", "penalty", "fine" — these are VAT-exempt (taxPct=0)

Matching Principle: record the expense in the period the benefit is received. Monthly recurring services (rent, utilities, subscriptions) should map to the account that reflects the period stated in the invoice.

{invoice_context}{history_section}Items (index: category — description | unit price):
{items_block}

Departments:
{dept_lines or "  (none)"}

Expense accounts ({expense_acc_count}):
{expense_acc_lines or "  (none)"}

Instructions:
- Match each item's category and description to the most suitable expense account and department.
- When vendor history has a similar description, strongly prefer that mapping.
- Always provide your best guess — never leave dept or acc empty.
- Use codes exactly as listed above.
- If truly uncertain, pick the closest match by name similarity.
Keys must be: {keys}
{{{template}}}"""
