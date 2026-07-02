ALTER TABLE billing_documents
  ADD COLUMN IF NOT EXISTS buyer_tel VARCHAR(50);
