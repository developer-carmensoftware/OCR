-- A manual scan's second Carmen document: the input-tax (ACTX) record.
--
-- The wizard posts the JV on step 3 and the input tax on step 4, and until now only the
-- first left a trace here (`submitted_at`, `jv_no`). A session that expired between the two
-- lost the VAT claim with nothing in this app knowing: the only copy of what step 4 needed
-- was the browser draft, which lives six hours, on one machine, and is offered only on the
-- Manual page — not on the queue a returning user actually lands on.
--
-- `commis_amt` and `tax_amt` are the two sums the ACTX claims, stamped with the JV. They are
-- header totals like `doc_no`, not line items, so "line items are never persisted" holds.
-- They are what lets the activity table say "input tax not recorded" and file it from there.
-- NULL on every row posted before this migration, which is why those rows raise no note —
-- nobody knows what they owed.

alter table credit_cards
    add column if not exists commis_amt numeric(14, 2),
    add column if not exists tax_amt numeric(14, 2),
    add column if not exists input_tax_at timestamptz;

comment on column credit_cards.commis_amt is
    'Sum of the statement''s commission before VAT, stamped when the JV posts. The ACTX BfTaxAmt.';
comment on column credit_cards.tax_amt is
    'Sum of the statement''s VAT, stamped when the JV posts. The ACTX TaxAmt; > 0 means one is owed.';
comment on column credit_cards.input_tax_at is
    'When this app filed the input-tax record in Carmen. NULL with tax_amt > 0 = still owed.';
