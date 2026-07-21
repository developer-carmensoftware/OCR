-- AR Customer Profiles: unique buyer companies extracted from billing_documents.
-- Admin maps each to a Carmen AR code for ERP posting.

create table if not exists ar_customer_profiles (
    id             uuid         primary key default gen_random_uuid(),
    buyer_name     varchar(255) not null,
    buyer_tax_id   varchar(20)  not null default '',
    buyer_branch   varchar(100) not null default '',
    carmen_ar_code varchar(50),
    created_at     timestamptz  not null default now(),
    updated_at     timestamptz  not null default now(),
    deleted_at     timestamptz
);

create unique index if not exists uq_ar_profiles_taxid_branch
    on ar_customer_profiles (buyer_tax_id, buyer_branch)
    where deleted_at is null and buyer_tax_id != '';

create index if not exists ix_ar_profiles_name
    on ar_customer_profiles (buyer_name)
    where deleted_at is null;
