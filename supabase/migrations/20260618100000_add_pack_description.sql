-- Add a description column to credit_packs for proforma line-item text.
ALTER TABLE credit_packs ADD COLUMN IF NOT EXISTS description TEXT;

UPDATE credit_packs SET description = CASE code
    WHEN 'sub_starter'  THEN 'Starter Plan — 200 credits/month'
    WHEN 'sub_standard' THEN 'Standard Plan — 500 credits/month'
    WHEN 'sub_pro'      THEN 'Professional Plan — 1,500 credits/month'
    WHEN 'pack_small'   THEN 'Top-up — 500 credits'
    WHEN 'pack_medium'  THEN 'Top-up — 2,500 credits'
    WHEN 'pack_large'   THEN 'Top-up — 10,000 credits'
    ELSE code
END
WHERE description IS NULL;
