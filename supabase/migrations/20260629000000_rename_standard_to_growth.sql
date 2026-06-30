-- Rename plan code sub_standard → sub_growth (display name: Standard → Growth).
-- The internal code is a PK referenced by 3 FK columns; we clone → repoint → delete.
begin;

-- 1. Clone the catalog row under the new code (column-agnostic).
create temporary table _clone as
  select * from credit_packs where code = 'sub_standard';
update _clone set code = 'sub_growth';
insert into credit_packs select * from _clone;
drop table _clone;

-- 2. Repoint every FK child + the billing_documents snapshot.
update credit_orders        set pack_code = 'sub_growth' where pack_code = 'sub_standard';
update tenant_subscriptions set plan_code = 'sub_growth' where plan_code = 'sub_standard';
update credit_ledger        set pack_code = 'sub_growth' where pack_code = 'sub_standard';
update billing_documents    set pack_code = 'sub_growth' where pack_code = 'sub_standard';

-- 3. Update the future-invoice line label.
update credit_packs set description = 'Growth Plan — 500 credits/month' where code = 'sub_growth';

-- 4. Drop the old row (no children remain).
delete from credit_packs where code = 'sub_standard';

commit;
