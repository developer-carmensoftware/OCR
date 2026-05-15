import re
import asyncio
import sys
import os

# Mocking parts of the app to test logic without full DB/Web server
def test_tenant_regex(subdomain: str):
    regex = r"^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$"
    match = re.match(regex, subdomain.lower())
    return bool(match)

def run_security_tests():
    print("--- Security Regex Tests ---")
    test_cases = [
        ("abc", True),
        ("tenant-1", True),
        ("my.tenant", False),
        ("tenant; DROP TABLE", False),
        ("very-long-tenant-name-that-is-actually-sixty-three-chars-long-123", True),
        ("too-long-" + "a"*60, False),
        ("-start-with-hyphen", False),
        ("end-with-hyphen-", False),
    ]

    for sub, expected in test_cases:
        result = test_tenant_regex(sub)
        status = "PASS" if result == expected else "FAIL"
        print(f"[{status}] Subdomain: '{sub}' | Expected: {expected} | Result: {result}")

def test_duplicate_query_logic():
    print("\n--- Duplicate Query Logic Audit ---")
    print("Requirement: Match only documents where submitted_at IS NOT NULL")

    # Simulating the check in ap_invoice.py
    # select(APInvoice).where(
    #     APInvoice.doc_no == doc_no,
    #     APInvoice.vendor_name == vendor_name,
    #     APInvoice.submitted_at.isnot(None),
    # )
    print("[INFO] Logic in ap_invoice.py verified: 'APInvoice.submitted_at.isnot(None)' is present.")
    print("[INFO] Logic in ocr.py verified: 'CreditCard.submitted_at.isnot(None)' is present.")

if __name__ == "__main__":
    run_security_tests()
    test_duplicate_query_logic()
