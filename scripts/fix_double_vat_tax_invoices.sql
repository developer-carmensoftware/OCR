-- One-off remediation: fix tax invoices whose figures were double-VATed.
--
-- Bug (fixed in routers/admin/credits.py 2026-07-02): the tax invoice was issued by
-- passing order.amount_thb (GROSS, VAT-inclusive) into issue_document, which treats its
-- input as NET and adds VAT on top. Result: subtotal = the real gross, total = gross×1.07.
-- e.g. real sale 490 net / 34.30 vat / 524.30 total  →  stored 524.30 / 36.70 / 561.00.
--
-- The matching PROFORMA for the same order was issued from the NET and is CORRECT, so it
-- is the source of truth for the correction.
--
-- Run manually against the Supabase Postgres (psql / SQL editor), IN ORDER. Review STEP 1,
-- take a backup, CAPTURE STEP 2's Carmen list FIRST (its predicate needs the still-wrong
-- rows), then run STEP 3's correction inside a transaction.

-- ── STEP 1: AUDIT — affected tax invoices (subtotal was actually the gross) ────────────
-- A double-VATed row satisfies: round(subtotal * (1 + vat_rate/100), 2) == total.
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
  -- only rows that actually disagree with the (correct) proforma
  AND (ti.subtotal <> pf.subtotal OR ti.vat_amount <> pf.vat_amount OR ti.total <> pf.total);

-- ── STEP 2: MANUAL — Carmen AR entries already posted with wrong figures (RUN FIRST) ───
-- Must be captured BEFORE STEP 3's correction (afterwards the predicate matches nothing).
-- These were sent to Carmen ERP with the inflated total and cannot be corrected from here.
-- Hand this list to finance to reverse / re-post each AR entry with the corrected total.
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

-- ── STEP 3: CORRECTION — copy the proforma's figures onto the tax invoice ──────────────
-- Wrap in a transaction; run the STEP 1 SELECT again after COMMIT to confirm it returns 0.
-- BEGIN;
UPDATE billing_documents ti
SET subtotal   = pf.subtotal,
    vat_amount = pf.vat_amount,
    total      = pf.total
FROM billing_documents pf
WHERE pf.order_id = ti.order_id
  AND pf.doc_type = 'proforma'
  AND pf.deleted_at IS NULL
  AND ti.doc_type = 'tax_invoice'
  AND ti.deleted_at IS NULL
  AND ROUND(ti.subtotal * (1 + ti.vat_rate / 100), 2) = ti.total
  AND (ti.subtotal <> pf.subtotal OR ti.vat_amount <> pf.vat_amount OR ti.total <> pf.total);
-- COMMIT;
