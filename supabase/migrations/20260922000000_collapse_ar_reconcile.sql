-- Collapse the settlement-report feature's own mapping table into the credit-card
-- wizard's — decision #3, docs/email-automation/06-decision-log.md #29.
--
-- Decision #28 (2026-09-18) made a settlement JV's three fixed debit legs read the same
-- commission/tax/net mapping the fee-invoice JV already used
-- (bu_accounting_mapping_entries), rather than a control account of this feature's own.
-- That left ar_reconcile_mappings holding only the credit side (payment type -> GL
-- account), a second table for what is, after decision #28, the same kind of row the
-- fee invoice already stores in bu_accounting_mapping_entries — Detail and Summary keys
-- ("VS INTER UP PREM" vs "VS") never collide with each other or with a fee-invoice
-- payment type, so nothing stops them sharing one table without post_type being part
-- of a uniqueness key here.
--
-- What this migration does:
--   1. banks.settlement_grouping — replaces the SUPPORTED_BANKS / RECONCILABLE_BANKS
--      constants in ar_reconcile_service.py (decision #8). NULL = no settlement layout;
--      the value names the fold rule for readability, nothing dispatches on it yet.
--   2. bu_accounting_mapping_entries.source — informational only; the JV builder
--      resolves a key by plain string lookup and never reads it.
--   3. Backfill ar_reconcile_mappings -> bu_accounting_mapping_entries, skipping any row
--      that would collide with one already there (decision #5) — see queries.sql item 26
--      for the report of what got skipped and needs a human to reconcile by hand.
--   4. Rename ar_reconcile_mappings to ar_reconcile_mappings_archived rather than
--      dropping it, so a skipped row's original value is never lost.
--   5. Deactivate the cc_ar_reconcile module switch (decision #1) — a settlement report
--      is part of the credit-card module now, not a separately entitled add-on.
--      module_id itself is untouched: ocr_tasks and daily_usage_summary still need it to
--      report a settlement report's cost apart from a fee invoice's.


alter table banks add column settlement_grouping varchar(20);
update banks set settlement_grouping = 'first_token' where code = 'KBANK';


alter table bu_accounting_mapping_entries add column source varchar(20);


-- Backfill. ON CONFLICT targets uq_bu_mapping_entry_active exactly (config_id, field_type
-- where deleted_at is null) — every row this INSERT creates has deleted_at unset (NULL),
-- so it always qualifies for that index and a genuine collision is skipped rather than
-- erroring the whole migration out.
insert into bu_accounting_mapping_entries
    (config_id, field_type, dept_code, acc_code, is_custom, source, created_at)
select
    bac.id,
    arm.payment_type_code,
    arm.credit_dept_code,
    arm.credit_account_code,
    true,
    case arm.post_type
        when 'Detail'  then 'settlement_detail'
        when 'Summary' then 'settlement_summary'
        else null
    end,
    arm.created_at
from ar_reconcile_mappings arm
join ar_reconcile_settings ars on ars.id = arm.setting_id and ars.deleted_at is null
join bu_accounting_configs bac on bac.tenant_id = ars.tenant_id and bac.deleted_at is null
where arm.deleted_at is null
on conflict (config_id, field_type) where deleted_at is null do nothing;


alter table ar_reconcile_mappings rename to ar_reconcile_mappings_archived;


update modules set is_active = false where id = 'cc_ar_reconcile';
