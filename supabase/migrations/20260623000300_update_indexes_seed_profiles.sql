-- 1. Rebuild the one-open-per-tenant partial unique index for the new enum.
drop index if exists uq_credit_orders_one_open_per_tenant;
create unique index uq_credit_orders_one_open_per_tenant
    on credit_orders (tenant_id)
    where status = 'in_progress' and deleted_at is null;

-- 2. Seed ar_customer_profiles from existing billing_documents buyer snapshots.
insert into ar_customer_profiles (buyer_name, buyer_tax_id, buyer_branch)
select distinct on (coalesce(buyer_tax_id, ''), coalesce(buyer_branch, ''))
    coalesce(buyer_name, ''),
    coalesce(buyer_tax_id, ''),
    coalesce(buyer_branch, '')
from billing_documents
where deleted_at is null
  and buyer_name is not null
  and buyer_name != ''
on conflict do nothing;
