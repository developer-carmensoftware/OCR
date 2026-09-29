-- GL mapping entries scoped per bank, not shared across every bank a BU handles.
--
-- `bu_accounting_mapping_entries` has always hung off `config_id` alone, and
-- `bu_accounting_configs` is one row per tenant (uq_bu_accounting_config_active) — so a BU
-- that receives statements from two banks has always had ONE shared set of payment-type
-- mappings for both. Worse than a display bug: `save_accounting_config` deletes every entry
-- for the config and reinserts from whatever the browser tab has loaded, so saving the
-- Mapping page while bank B is selected can silently destroy bank A's confirmed mappings if
-- that tab last loaded them for bank A. `bank_descriptions` (20260805020000) solved the same
-- shape of problem for one string by keying it per bank instead of splitting the config row —
-- same move here, on the entries table, so a BU's confirmed mappings stay confirmed.
--
-- Nullable, not required: an entry with no bank_code is the pre-migration shape (mappings
-- nobody has re-saved since this shipped). The backfill below gives every existing entry a
-- best-effort home — the config's own bank_code, the only bank the table has ever recorded —
-- so a single-bank tenant (the common case) sees no change at all. A tenant that actually
-- uses more than one bank starts the *other* banks with a clean slate, because there was
-- never a real per-bank mapping to recover; that is the bug this migration fixes, not data
-- this migration can invent.

alter table bu_accounting_mapping_entries
    add column if not exists bank_code varchar(20) references banks (code);

comment on column bu_accounting_mapping_entries.bank_code is
    'Which bank this GL mapping applies to. Null = pre-migration row, scoped by config_id '
    'alone. accounting_config_service falls back to bu_accounting_configs.bank_code when the '
    'caller does not name one, so a single-bank tenant needs no change.';

update bu_accounting_mapping_entries e
   set bank_code = c.bank_code
  from bu_accounting_configs c
 where e.config_id = c.id
   and e.bank_code is null
   and c.bank_code is not null;

create index if not exists ix_bu_accounting_mapping_entries_bank_code
    on bu_accounting_mapping_entries (bank_code);

drop index if exists uq_bu_mapping_entry_active;
create unique index uq_bu_mapping_entry_active
    on bu_accounting_mapping_entries (config_id, field_type, bank_code) where deleted_at is null;
