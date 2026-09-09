-- Lite: the entry subscription tier — 100 documents/month at ฿290 (฿2.90/doc).
-- Closes the gap between the 30-document signup grant and Starter (200/฿490).
--
-- sort_order 0 puts it ahead of Starter (1). The annual price is DERIVED at read
-- time by credit_service.annual_price() (×12×0.9 = ฿3,132) and never stored, so
-- there is nothing to keep in sync here. `description` is the proforma line item —
-- without it the invoice prints the raw code. Idempotent.
insert into credit_packs (code, kind, credits, price_thb, is_active, sort_order, description)
values ('sub_lite', 'subscription', 100, 290.00, true, 0, 'Lite Plan — 100 credits/month')
on conflict (code) do update set
    kind        = excluded.kind,
    credits     = excluded.credits,
    price_thb   = excluded.price_thb,
    is_active   = true,
    sort_order  = excluded.sort_order,
    description = excluded.description;
