-- 2026-09-30 (decision-log #33): the BU-wide JV description stops being a fallback.
--
-- bu_accounting_configs.description was what every bank without its own entry in
-- bank_descriptions posted under (description_for / descriptionForBank). It had become
-- read everywhere and editable nowhere: the Mapping page wrote it only while no bank was
-- selected -- which never happens once a BU has saved one -- and the review queue only
-- when a document had no bank. So a stray value (dev `carmen`: "TEST ACC") sat behind
-- every unconfigured bank with no screen able to change it. From this date a bank's
-- Description is its own entry, or nothing.
--
-- So that no JV changes wording, the BU-wide value is copied into each bank this BU
-- actually uses -- a bank it has GL mapping entries for, or its config's own bank_code --
-- whose own entry is empty. Never overwrites; idempotent. Both coalesces matter:
-- jsonb_object_agg over zero banks is NULL, and `|| NULL` would wipe bank_descriptions.
--
-- The column stays in the schema, unread and unwritten -- same precedent as
-- ar_reconcile_settings.jv_description_template (#30) and .enabled (#31). A bank the BU
-- starts using after this date begins with no description. Dry run: queries.sql item 29.
update bu_accounting_configs c
   set bank_descriptions = coalesce(c.bank_descriptions, '{}'::jsonb) || coalesce((
         select jsonb_object_agg(b.code, c.description)
           from (select distinct e.bank_code as code
                   from bu_accounting_mapping_entries e
                  where e.config_id = c.id
                    and e.deleted_at is null
                    and e.bank_code is not null
                 union
                 select c.bank_code
                  where c.bank_code is not null) b
          where coalesce(trim(c.bank_descriptions ->> b.code), '') = ''
       ), '{}'::jsonb)
 where c.deleted_at is null
   and coalesce(trim(c.description), '') <> '';

comment on column bu_accounting_configs.description is
    'Unread since 2026-09-30 (20260930000000_description_per_bank_only): a bank''s JV '
    'description is bank_descriptions[bank_code] alone. The value was copied into each '
    'bank the BU used; kept only as history.';
