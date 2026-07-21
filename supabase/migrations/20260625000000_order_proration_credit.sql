-- Add proration credit tracking to credit_orders (upgrade mid-plan).
ALTER TABLE credit_orders
  ADD COLUMN proration_credit_thb NUMERIC(10, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN credit_orders.proration_credit_thb
  IS 'Prorated credit from superseded plan, subtracted from the order net before VAT.';
