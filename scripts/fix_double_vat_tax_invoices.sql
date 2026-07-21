-- One-off remediation for the double-VAT bug (2026-07-02).
--
-- Bug history:
--   1. routers/admin/credits.py issued an internal TAX_INVOICE billing_document at
--      approve time by passing order.amount_thb (GROSS, VAT-inclusive) into
--      issue_document, which treats its input as NET and adds VAT on top.
--      Result: subtotal = the real gross, total = gross×1.07.
--      e.g. real sale 490 net / 34.30 vat / 524.30 total → stored 524.30 / 36.70 / 561.00.
--   2. post_ar read its AMOUNTS from that wrong tax_invoice row, so Carmen AR received
--      the inflated 561.00 even after the *code* was fixed — the STORED row was still wrong.
--
-- Final fix: the app no longer issues an internal tax invoice at all. post_ar now reads
-- amounts directly from the PROFORMA (issued at order-creation from the NET price, always
-- correct) — there is nothing left to keep in sync. This script only helps you find and
-- hand off the fallout from BEFORE that fix.
--
-- Run manually against the Supabase Postgres (psql / SQL editor).

-- ── STEP 1: AUDIT — legacy tax invoices that were double-VATed ─────────────────────────
-- A double-VATed row satisfies: round(subtotal * (1 + vat_rate/100), 2) == total, and
-- disagrees with its proforma (which is always correct).
SELECT
    ti.id,
    ti.number,
    ti.order_id,
    ti.subtotal      AS bad_subtotal,
    ti.vat_amount    AS bad_vat,
    ti.total         AS bad_total,
    pf.subtotal      AS correct_subtotal,
    pf.vat_amount    AS correct_vat,
    pf.total         AS correct_total,
    o.carmen_ar_posted_at,
    o.carmen_ar_ref
FROM billing_documents ti
JOIN billing_documents pf
    ON pf.order_id = ti.order_id
   AND pf.doc_type = 'proforma'
   AND pf.deleted_at IS NULL
LEFT JOIN credit_orders o ON o.id = ti.order_id
WHERE ti.doc_type = 'tax_invoice'
  AND ti.deleted_at IS NULL
  AND ROUND(ti.subtotal * (1 + ti.vat_rate / 100), 2) = ti.total
  AND (ti.subtotal <> pf.subtotal OR ti.vat_amount <> pf.vat_amount OR ti.total <> pf.total);

-- ── STEP 2: MANUAL — Carmen AR entries already posted with the wrong total ─────────────
-- These were sent to Carmen ERP with the inflated total and cannot be corrected from here
-- (no delete/amend API for AR entries in this app). Hand this list to finance to reverse
-- or re-post each entry with the correct_total.
SELECT
    o.id            AS order_id,
    ti.number       AS tax_invoice_number,
    pf.number       AS proforma_number,
    o.carmen_ar_ref,
    o.carmen_ar_posted_at,
    ti.total        AS posted_wrong_total,
    pf.total        AS correct_total
FROM credit_orders o
JOIN billing_documents ti
    ON ti.order_id = o.id AND ti.doc_type = 'tax_invoice' AND ti.deleted_at IS NULL
JOIN billing_documents pf
    ON pf.order_id = o.id AND pf.doc_type = 'proforma' AND pf.deleted_at IS NULL
WHERE o.carmen_ar_posted_at IS NOT NULL
  AND ROUND(ti.subtotal * (1 + ti.vat_rate / 100), 2) = ti.total
  AND (ti.subtotal <> pf.subtotal OR ti.total <> pf.total);

-- ── Not-yet-posted orders needing no manual fix ─────────────────────────────────────────
-- Any PAID order that hasn't been posted to Carmen yet (carmen_ar_posted_at IS NULL) will
-- automatically post the CORRECT proforma total the next time post_ar runs, once this fix
-- is deployed — no data correction needed for those, only a redeploy.
