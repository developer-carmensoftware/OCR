-- One document posts to Carmen once.
--
-- The guard already existed in application code (`has_submitted_doc` on the way
-- in, `submitted_at` stamped on the way out) but only the wizard ever stamped it,
-- so the email-ingest job was invisible to its own check: the same bank report
-- forwarded automatically AND by hand produced two JVs in the customer's books.
-- Found by re-forwarding one SIAMPAY report on 2026-08-04 — JV 966 and 967 for
-- document RE2026-05269. CARMEN_INTEGRATION.md §0.1 promises the opposite.
--
-- The stamp is now written by both paths. This index is the part the application
-- cannot do for itself: it closes the check→post→stamp window, and it makes a
-- future path that forgets to stamp fail loudly instead of silently double-posting.
--
-- Partial, and deliberately so:
--   submitted_at is not null → drafts and parked documents may repeat freely;
--                              only what actually reached Carmen is unique
--   deleted_at is null       → a soft-deleted row can be superseded
--                              (same shape as uq_credit_cards_task, 20260615000007)
--
-- bank_code and doc_no are nullable; a NULL in either makes the row exempt, which
-- is correct — a document we could not identify is not a document we can prove is
-- a repeat, and the tax-ID gate is what stops those.

create unique index if not exists uq_credit_cards_submitted_doc
    on credit_cards (tenant_id, bank_code, doc_no)
    where submitted_at is not null and deleted_at is null;

comment on index uq_credit_cards_submitted_doc is
    'One posted JV per (tenant, bank, doc_no). Enforces the duplicate guard that '
    'app code checks but could skip — see routers/carmen.py and email_ingest_service.';
