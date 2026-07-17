-- Reprice top-up packs (credit counts unchanged). Idempotent.
-- small ฿1,200→฿2,000 (฿4/doc), medium ฿5,000→฿7,500 (฿3/doc), large ฿15,000→฿20,000 (฿2/doc).
update credit_packs set price_thb = 2000.00  where code = 'pack_small';
update credit_packs set price_thb = 7500.00  where code = 'pack_medium';
update credit_packs set price_thb = 20000.00 where code = 'pack_large';
