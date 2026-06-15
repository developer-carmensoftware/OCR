-- Billing seed data — ported from _m218_billing_documents_and_slip + _m219_pricing_catalog_v2.
-- All INSERTs use ON CONFLICT DO NOTHING / DO UPDATE: idempotent.

-- ── system_configs: billing keys ──────────────────────────────────────────────
insert into system_configs (key_name, value, value_type, category, description, is_secret, requires_restart, created_at, updated_at)
values
    ('billing.promptpay_id',       '""',                 'string', 'billing', 'PromptPay ID (mobile or tax ID) that customers scan to pay',    false, false, now(), now()),
    ('billing.seller_name',        '""',                 'string', 'billing', 'Company name printed on invoices',                              false, false, now(), now()),
    ('billing.seller_tax_id',      '""',                 'string', 'billing', '13-digit tax ID printed on invoices',                           false, false, now(), now()),
    ('billing.seller_address',     '""',                 'string', 'billing', 'Full address printed on invoices',                              false, false, now(), now()),
    ('billing.seller_branch',      '"สำนักงานใหญ่"',     'string', 'billing', 'Branch name (e.g. สำนักงานใหญ่)',                              false, false, now(), now()),
    ('billing.vat_rate',           '"7"',                'string', 'billing', 'VAT rate % (default 7)',                                        false, false, now(), now()),
    ('billing.carmen_company_path','""',                 'string', 'billing', 'Optional Carmen API path to fetch buyer company profile',       false, false, now(), now())
on conflict (key_name) do nothing;


-- ── credit_packs: v2 published catalog ────────────────────────────────────────
-- Deactivate legacy placeholder codes if they exist (from any previous runs).
update credit_packs
   set is_active = false
 where code in ('p100','p500','p1000','p5000','starter','pro','enterprise');

-- Upsert the canonical 6-item catalog.
-- Subscriptions = monthly document allowance; Top-ups = non-expiring credits.
insert into credit_packs (code, kind, credits, price_thb, is_active, sort_order, created_at)
values
    ('sub_starter',  'subscription', 200,   490.00,  true, 1,  now()),
    ('sub_standard', 'subscription', 500,   990.00,  true, 2,  now()),
    ('sub_pro',      'subscription', 1500,  2490.00, true, 3,  now()),
    ('pack_small',   'topup',        500,   1200.00, true, 11, now()),
    ('pack_medium',  'topup',        2500,  5000.00, true, 12, now()),
    ('pack_large',   'topup',        10000, 15000.00,true, 13, now())
on conflict (code) do update set
    kind       = excluded.kind,
    credits    = excluded.credits,
    price_thb  = excluded.price_thb,
    is_active  = true,
    sort_order = excluded.sort_order;
