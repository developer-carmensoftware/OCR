-- Ticket D (2026-09-22): the JV description mechanism folds into one field.
--
-- A settlement JV's wording used to be its own column, ar_reconcile_settings
-- .jv_description_template, rendered as a template ({Settlement_Date} etc.). The
-- fee-invoice path's own wording (bu_accounting_configs.bank_descriptions, keyed by
-- bank_code) never supported tags and just appended " - <doc date>". Both now go
-- through the same rendering (app/services/cc_jv.py: render_description /
-- resolve_jv_description), reading only bank_descriptions -- a tagged value is
-- treated as a template, a plain one gets the old date suffix, so every existing
-- fee-invoice description keeps posting exactly the text it always has.
--
-- This migration only moves data forward for a bank that had actually customized its
-- settlement wording; it changes no application code (that shipped in the same PR) and
-- ar_reconcile_settings.jv_description_template is left in the schema, unused, same
-- precedent as debit_dept_code/debit_account_code from decision #28 -- nothing here is
-- destructive or hard to reverse.
--
-- Backfill rule, matching 20260922000000_collapse_ar_reconcile.sql's own non-clobbering
-- shape: copy a bank's customized template into bank_descriptions[bank_code] only when
-- that slot is empty and the template differs from the untouched default. A bank with
-- both already set is left alone and is a hand-resolution case -- see queries.sql
-- item 27 for the conflict report to run first.
update bu_accounting_configs c
set bank_descriptions = jsonb_set(
    c.bank_descriptions,
    array[s.bank_code],
    to_jsonb(s.jv_description_template)
)
from ar_reconcile_settings s
where c.tenant_id = s.tenant_id
  and c.deleted_at is null
  and s.deleted_at is null
  and coalesce(trim(s.jv_description_template), '') <> ''
  and trim(s.jv_description_template) <> 'Credit Card AR Reconcile {Settlement_Date}'
  and coalesce(trim(c.bank_descriptions ->> s.bank_code), '') = '';
