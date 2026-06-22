ALTER TABLE billing_documents
  ADD COLUMN IF NOT EXISTS buyer_contact_name VARCHAR(255);
