-- 2026-10-01: GL mapping entries with no bank stop answering for every bank.
--
-- Before 20260924000000 a BU's mapping entries had no bank. The backfill could only give
-- an entry a bank where the config row named one, so a BU whose row did not (dev
-- `carmencloud`: all 29 of its entries) kept bank-less entries, and a bank-scoped read
-- fell back to them for any field the bank had no entry of its own for (F-8). That kept
-- those BUs posting, but the mapping page could never clear one: a payment type deleted
-- there came back from the fallback, and what a bank's mappings "were" depended on a rule
-- no screen showed.
--
-- So each bank-less entry is copied to every bank this BU actually has documents for (or
-- its config's own bank_code) that has no entry of its own for that field -- the same
-- answer every such bank was getting through the fallback -- and then retired. A bank
-- the BU never had a document for starts empty. Never overwrites; idempotent (a second
-- run finds nothing bank-less); an entry whose BU names no bank at all is left alone
-- rather than dropped, since there is nowhere to put it. Dry run: queries.sql item 30.
--
-- Order matters, opposite to 20260930000000: this must be pushed BEFORE the code that
-- stops reading bank-less entries is deployed. Code first and every bank of such a BU
-- reads empty -- each document parks `mapping_missing`, an auto-post BU stops posting.
insert into bu_accounting_mapping_entries
    (config_id, field_type, dept_code, acc_code, is_custom, source, bank_code)
select e.config_id, e.field_type, e.dept_code, e.acc_code, e.is_custom, e.source, b.code
  from bu_accounting_mapping_entries e
  join bu_accounting_configs c on c.id = e.config_id and c.deleted_at is null
 cross join lateral (
        select cc.bank_code as code
          from credit_cards cc
         where cc.tenant_id = c.tenant_id
           and cc.deleted_at is null
           and cc.bank_code is not null
        union
        select c.bank_code where c.bank_code is not null
       ) b
 where e.deleted_at is null
   and e.bank_code is null
   and not exists (
        select 1
          from bu_accounting_mapping_entries o
         where o.config_id = e.config_id
           and o.field_type = e.field_type
           and o.bank_code = b.code
           and o.deleted_at is null);

update bu_accounting_mapping_entries e
   set deleted_at = now()
  from bu_accounting_configs c
 where c.id = e.config_id
   and c.deleted_at is null
   and e.deleted_at is null
   and e.bank_code is null
   and (c.bank_code is not null
        or exists (select 1
                     from credit_cards cc
                    where cc.tenant_id = c.tenant_id
                      and cc.deleted_at is null
                      and cc.bank_code is not null));
