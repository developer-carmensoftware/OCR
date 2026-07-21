-- Payment-info config keys for the proforma (bank transfer + crossed cheque).
-- QR payment is paused; the proforma now carries the pay-to bank details.
-- Seeded with Carmen Software defaults from the proforma mockup.
insert into system_configs (key_name, value, value_type, category, description, is_secret, requires_restart, created_at, updated_at)
values
    ('billing.bank_name',         '"Bangkok Bank (ธนาคารกรุงเทพ)"',                      'string', 'billing', 'Bank name printed on the proforma',          false, false, now(), now()),
    ('billing.bank_account_no',   '"195-4-97445-5"',                                      'string', 'billing', 'Bank account number for transfers',          false, false, now(), now()),
    ('billing.bank_account_name', '"CARMEN SOFTWARE CO., LTD."',                           'string', 'billing', 'Bank account holder name',                   false, false, now(), now()),
    ('billing.bank_account_type', '"Savings Account (ออมทรัพย์)"',                          'string', 'billing', 'Account type',                               false, false, now(), now()),
    ('billing.bank_branch',       '"Ratchada - Sathupradit Intersection"',                 'string', 'billing', 'Bank branch',                                false, false, now(), now()),
    ('billing.cheque_payee',      '"CARMEN SOFTWARE CO., LTD."',                           'string', 'billing', 'Crossed-cheque payee name',                  false, false, now(), now()),
    ('billing.seller_name_en',    '"CARMEN SOFTWARE CO., LTD."',                           'string', 'billing', 'Company name in English for proforma header', false, false, now(), now()),
    ('billing.seller_phone',      '"Tel: 66 2 284 0429 | Fax: 66 2 284 3944"',            'string', 'billing', 'Contact phone/fax printed on proforma',      false, false, now(), now())
on conflict (key_name) do update set
    value = excluded.value,
    updated_at = now()
where system_configs.value = '""';
