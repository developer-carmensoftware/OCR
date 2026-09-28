"""
Generate sample PDFs for testing the encrypted-PDF flow.

Creates four files under backend/scripts/test_pdfs/:
  1. credit_card_locked.pdf   — 1 page, user password "1234"  (credit card statement)
  2. ap_invoice_locked.pdf    — 1 page, user password "1234"  (AP invoice)
  3. multipage_locked.pdf     — 3 pages, user password "1234" (tests page selector + password)
  4. owner_only.pdf           — 1 page, NO user password but owner-locked (must open with no prompt)

Run from the backend dir with the venv active:
    python scripts/make_test_pdfs.py

PyMuPDF (fitz) is already a project dependency.
"""

import os

import fitz

USER_PASSWORD = "1234"
OUT_DIR = os.path.join(os.path.dirname(__file__), "test_pdfs")
ENC = fitz.PDF_ENCRYPT_AES_256


def _page(doc: fitz.Document, lines: list[str]) -> None:
    """Append a page with the given text lines (simple black text, A4)."""
    page = doc.new_page(width=595, height=842)  # A4 in points
    y = 72
    for i, line in enumerate(lines):
        size = 16 if i == 0 else 11
        page.insert_text((72, y), line, fontsize=size, color=(0, 0, 0))
        y += size + 8


def build(filename: str, pages: list[list[str]], user_pw: str, owner_pw: str = "owner") -> str:
    doc = fitz.open()
    for lines in pages:
        _page(doc, lines)
    path = os.path.join(OUT_DIR, filename)
    doc.save(path, encryption=ENC, owner_pw=owner_pw, user_pw=user_pw)
    doc.close()
    return path


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)

    credit_card = [
        "BANGKOK BANK - Credit Card Merchant Statement",
        "Merchant Name: DEMO SHOP CO., LTD.",
        "Merchant ID: 0123456789",
        "Document No: CC-2026-0001",
        "Statement Date: 15/06/2026",
        "",
        "Transaction       Pay Amount   Commission   VAT 7%     Net Total",
        "VISA Purchase      10,000.00      300.00      21.00     9,679.00",
        "MASTERCARD         5,000.00       150.00      10.50     4,839.50",
    ]

    ap_invoice = [
        "TAX INVOICE / RECEIPT",
        "Vendor: ACME SUPPLIES CO., LTD.",
        "Tax ID: 0105500000001  (Head Office)",
        "Invoice No: INV-2026-7788",
        "Invoice Date: 15/06/2026",
        "",
        "Description            Qty   Unit Price   Amount",
        "A4 Paper (ream)        10      120.00    1,200.00",
        "Ballpoint Pen (box)     5       85.00      425.00",
        "",
        "Sub Total: 1,625.00   VAT 7%: 113.75   Grand Total: 1,738.75",
    ]

    multipage = [
        ["AP INVOICE - PAGE 1 of 3", "Vendor: MULTIPAGE VENDOR LTD.", "Invoice No: MP-001"],
        ["AP INVOICE - PAGE 2 of 3", "Continued line items...", "More rows here"],
        ["AP INVOICE - PAGE 3 of 3", "Summary / Totals", "Grand Total: 9,999.00"],
    ]

    created = [
        build("credit_card_locked.pdf", [credit_card], USER_PASSWORD),
        build("ap_invoice_locked.pdf", [ap_invoice], USER_PASSWORD),
        build("multipage_locked.pdf", multipage, USER_PASSWORD),
        # Owner-locked only (no user password) — should open WITHOUT prompting.
        build("owner_only.pdf", [credit_card], user_pw=""),
    ]

    print(f"User password for locked files: {USER_PASSWORD!r}\n")
    for path in created:
        size = os.path.getsize(path)
        print(f"  created {path}  ({size:,} bytes)")


if __name__ == "__main__":
    main()
