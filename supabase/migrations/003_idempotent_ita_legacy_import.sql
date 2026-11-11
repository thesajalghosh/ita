-- Make legacy ITA entry imports idempotent across browsers and devices.
ALTER TABLE ita_sales
  ADD COLUMN IF NOT EXISTS source_entry_id UUID;

ALTER TABLE ita_payments
  ADD COLUMN IF NOT EXISTS source_entry_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ita_sales_source_entry_id
  ON ita_sales(source_entry_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ita_payments_source_entry_id
  ON ita_payments(source_entry_id);
