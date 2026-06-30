-- Reference data: LLM model pricing (synced from OpenRouter every 8h via pg_cron).

create table if not exists model_pricing (
    model_name           varchar(255)    primary key,
    input_price_per_1m   numeric(18, 9)  not null default 0,
    output_price_per_1m  numeric(18, 9)  not null default 0,
    source               varchar(50)     not null default 'manual',
    price_verified_at    timestamptz,
    created_at           timestamptz     not null default now(),
    updated_at           timestamptz              default now()
);

create index if not exists ix_model_pricing_created_at on model_pricing (created_at);
