-- CA-4: add 5 credit-card commission formats (CA-71)
-- BAY is a bank statement layout; KTC/GHL/PAYPAL/SIAMPAY are processor fee invoices.
insert into banks (code, name, display_name_th, is_active, sort_order, created_at)
values
    ('BAY',     'Bank of Ayudhya (Krungsri)',   'ธนาคารกรุงศรีอยุธยา',              true, 4, now()),
    ('KTC',     'Krungthai Card',               'บริษัท บัตรกรุงไทย จำกัด (มหาชน)', true, 5, now()),
    ('GHL',     'GHL (NTT DATA Payment)',       'จีเอชแอล',                          true, 6, now()),
    ('PAYPAL',  'PayPal Thailand',              'เพย์พาล',                           true, 7, now()),
    ('SIAMPAY', 'SiamPay (Asia Pay Thailand)',  'สยามเพย์',                          true, 8, now())
on conflict (code) do nothing;
