-- Billing: credit packs, tenant balances, ledger, orders, documents, sequences.

do $$ begin
    create type creditledgerreason as enum ('topup', 'consumption', 'admin_adjust', 'refund');
exception when duplicate_object then null; end $$;

do $$ begin
    create type creditorderstatus as enum ('pending', 'awaiting_review', 'paid', 'rejected', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
    create type billingdocumenttype as enum ('proforma', 'tax_invoice');
exception when duplicate_object then null; end $$;


create table if not exists credit_packs (
    code        varchar(20)   primary key,
    kind        varchar(20)   not null default 'topup',  -- 'subscription' | 'topup'
    credits     integer       not null,
    price_thb   numeric(10, 2) not null,
    is_active   boolean       not null default true,
    sort_order  integer       not null default 0,
    created_at  timestamptz   not null default now(),
    updated_at  timestamptz            default now(),
    created_by  varchar(100),
    updated_by  varchar(100)
);

create index if not exists ix_credit_packs_created_at on credit_packs (created_at);


create table if not exists tenant_credits (
    tenant_id          uuid    primary key references tenants (id),
    balance            integer not null default 0,
    credits_purchased  integer not null default 0,
    credits_consumed   integer not null default 0,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz          default now()
);

create index if not exists ix_tenant_credits_created_at on tenant_credits (created_at);


create table if not exists credit_ledger (
    id            uuid                 primary key default gen_random_uuid(),
    tenant_id     uuid                 not null references tenants (id),
    delta         integer              not null,  -- +grant / -consumption
    balance_after integer              not null,
    reason        creditledgerreason   not null,
    pack_code     varchar(20)          references credit_packs (code),
    ref           text,       -- ocr_task id / order id / filename
    note          text,
    created_at    timestamptz          not null default now(),
    updated_at    timestamptz                   default now(),
    created_by    varchar(100),
    updated_by    varchar(100)
);

-- Primary query: per-tenant ledger ordered by time.
create index if not exists ix_credit_ledger_tenant_created on credit_ledger (tenant_id, created_at);
create index if not exists ix_credit_ledger_created_at     on credit_ledger (created_at);


create table if not exists credit_orders (
    id               uuid               primary key default gen_random_uuid(),
    tenant_id        uuid               not null references tenants (id),
    pack_code        varchar(20)        not null references credit_packs (code),
    credits          integer            not null,
    amount_thb       numeric(10, 2)     not null,
    status           creditorderstatus  not null default 'pending',
    payment_ref      varchar(128),
    paid_at          timestamptz,
    approved_by      varchar(100),
    approved_at      timestamptz,
    slip_object_key  varchar(512),
    slip_uploaded_at timestamptz,
    rejected_reason  text,
    created_at       timestamptz        not null default now(),
    updated_at       timestamptz                 default now(),
    deleted_at       timestamptz,
    deleted_by       varchar(100),
    created_by       varchar(100),
    updated_by       varchar(100)
);

create index if not exists ix_credit_orders_tenant_id   on credit_orders (tenant_id);
create index if not exists ix_credit_orders_created_at  on credit_orders (created_at);
create index if not exists ix_credit_orders_deleted_at  on credit_orders (deleted_at);

-- Active orders visible in admin triage list.
create index if not exists ix_credit_orders_tenant_status
    on credit_orders (tenant_id, status)
    where deleted_at is null;

-- Block duplicate open orders: only one pending/awaiting_review per pack per tenant.
create unique index if not exists uq_credit_orders_one_open_per_pack
    on credit_orders (tenant_id, pack_code)
    where status in ('pending', 'awaiting_review') and deleted_at is null;


create table if not exists billing_documents (
    id              uuid                 primary key default gen_random_uuid(),
    tenant_id       uuid                 not null references tenants (id),
    order_id        uuid                 not null references credit_orders (id),
    doc_type        billingdocumenttype  not null,
    number          varchar(50)          not null,   -- PF-202606-0001 / IV-202606-0001
    issue_date      timestamptz          not null,
    seller_name     varchar(255),
    seller_tax_id   varchar(20),
    seller_address  text,
    seller_branch   varchar(100),
    buyer_name      varchar(255),
    buyer_tax_id    varchar(20),
    buyer_address   text,
    buyer_branch    varchar(100),
    pack_code       varchar(20)          not null,
    description     text,
    credits         integer              not null,
    subtotal        numeric(12, 2)       not null,
    vat_rate        numeric(4, 2)        not null default 7.00,
    vat_amount      numeric(12, 2)       not null,
    total           numeric(12, 2)       not null,
    currency        varchar(3)           not null default 'THB',
    created_at      timestamptz          not null default now(),
    updated_at      timestamptz                   default now(),
    deleted_at      timestamptz,
    deleted_by      varchar(100)
);

create index if not exists ix_billing_documents_created_at  on billing_documents (created_at);
create index if not exists ix_billing_documents_deleted_at  on billing_documents (deleted_at);
create index if not exists ix_billing_documents_tenant_type on billing_documents (tenant_id, doc_type, created_at);

create unique index if not exists uq_billing_documents_number_active
    on billing_documents (number)
    where deleted_at is null;


create table if not exists document_sequences (
    -- Atomic gapless counter: INSERT ... ON CONFLICT DO UPDATE SET last_no = last_no + 1 RETURNING last_no
    -- scope      = 'proforma' | 'tax_invoice'
    -- period_key = 'YYYYMM'
    scope       varchar(20) not null,
    period_key  varchar(6)  not null,
    last_no     integer     not null default 0,
    primary key (scope, period_key)
);
