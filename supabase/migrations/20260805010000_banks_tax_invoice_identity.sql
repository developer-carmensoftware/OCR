-- The issuer's identity for the Carmen input-tax (ACTX) record.
--
-- The wizard posts two documents per statement: the GLJV, then an input-tax record
-- naming the bank that issued the tax invoice. Its VnName / TaxId / Address came
-- from BANK_INFO in frontend/src/constants/banks.ts — fine while a browser was
-- always in the loop, useless to the email-ingest job, which has no frontend and
-- was therefore posting the JV and silently skipping the input tax.
--
-- Put here rather than copied into a Python constant so that "adding a bank is an
-- INSERT" stays true (see CLAUDE.md); a second hardcoded copy would drift from the
-- first, and the frontend constant is now the one to retire.
--
-- Nullable: a bank with no identity recorded simply gets no input-tax record, which
-- is the behaviour before this migration, not a regression.

ALTER TABLE banks
    ADD COLUMN IF NOT EXISTS legal_name varchar(200),
    ADD COLUMN IF NOT EXISTS tax_id     varchar(20),
    ADD COLUMN IF NOT EXISTS address    varchar(500);

COMMENT ON COLUMN banks.legal_name IS 'Registered company name, verbatim onto the ACTX record (banks.name is the short UI label)';
COMMENT ON COLUMN banks.tax_id     IS '13-digit tax ID of the issuer, verbatim onto the ACTX record';
COMMENT ON COLUMN banks.address    IS 'Address exactly as the bank prints it on its tax invoice — copied, never parsed, so Thai stays Thai';

UPDATE banks SET legal_name = v.legal_name, tax_id = v.tax_id, address = v.address
FROM (VALUES
    ('BBL',   'Bangkok Bank Public Company Limited',            '0107536000374',
     '333 Silom Road, Bang Rak, Bangkok 10500'),
    ('KBANK', 'Kasikornbank Public Company Limited',            '0107536000315',
     '400/22 Phahonyothin Road, Samsen Nai, Phaya Thai, Bangkok 10400'),
    ('SCB',   'Siam Commercial Bank Public Company Limited',    '0107536000102',
     '9 Ratchadapisek Road, Chatuchak, Bangkok 10900'),
    ('BAY',   'Bank of Ayudhya Public Company Limited',         '0107536001079',
     '1222 Rama III Road, Bang Phongphang, Yan Nawa, Bangkok 10120'),
    ('KTC',   'Krungthai Card Public Company Limited',          '0107545000110',
     '591 United Business Centre II, 14th Fl., Sukhumvit Rd, North Klongton, Wattana, Bangkok 10110'),
    ('GHL',   'NTT DATA Digital Payment (Thailand) Co., Ltd.',  '0105556152330',
     '130/1 อาคารเศรษฐีวรรณ สาทร ชั้น 5 ถนนสาทรเหนือ แขวงสีลม เขตบางรัก จังหวัดกรุงเทพมหานคร 10500'),
    ('PAYPAL','PayPal Thailand Limited',                        '0105559010269',
     '63 Athenee Tower, 23rd Fl., Wireless Road, Lumpini, Pathumwan, Bangkok 10330'),
    ('SIAMPAY','Asia Pay (Thailand) Limited',                   '0105549071478',
     '141/63 Skulthai Surawong Tower, 38th Fl., Surawong Road, Suriyawong, Bang Rak, Bangkok 10500')
) AS v(code, legal_name, tax_id, address)
WHERE banks.code = v.code;
