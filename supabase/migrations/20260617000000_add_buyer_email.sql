ALTER TABLE billing_documents ADD COLUMN buyer_email VARCHAR(255);

-- Set default Carmen company profile path
UPDATE system_configs
   SET value = '"api/interface/rptGetCompany/undefined"'
 WHERE key_name = 'billing.carmen_company_path'
   AND value = '""';
