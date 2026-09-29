-- Micro: a top-up pack below pack_small for buyers who just want a small trial top-up.
-- Priced above every other tier per-credit (฿4.90/credit vs pack_small's ฿4.00) —
-- a deliberate small-quantity premium, not a pricing bug. sort_order 10 puts it
-- ahead of pack_small (11), matching ascending-credit order. Idempotent.
insert into credit_packs (code, kind, credits, price_thb, is_active, sort_order, description)
values ('pack_micro', 'topup', 100, 490.00, true, 10, 'Top-up — 100 credits')
on conflict (code) do update set
    kind        = excluded.kind,
    credits     = excluded.credits,
    price_thb   = excluded.price_thb,
    is_active   = true,
    sort_order  = excluded.sort_order,
    description = excluded.description;
