-- Which of the two KBANK credit-card documents a row came from.
--
-- KBANK prints ONE tax invoice number across two documents: the commission tax invoice the
-- wizard has always read, and the merchant settlement report (KB1P554V2) that reclassifies
-- the same day's takings. Both legitimately post their own JV. The duplicate guard keys on
-- (tenant_id, doc_no, doc_date) — deliberately not on bank_code, which is a separate fix
-- for the opposite failure — so without this column whichever arrives second is refused as
-- a copy of the first, silently, on a money path.
--
-- Separate from the AR-reconciliation migration that follows it: this is a correctness fix
-- to an existing guard and is safe to deploy on its own, before any of that feature exists.
-- Backfilled to 'fee_invoice' — every existing row is one.
alter table credit_cards
    add column doc_type varchar(20) not null default 'fee_invoice';
