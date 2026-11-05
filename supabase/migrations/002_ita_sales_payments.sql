-- ============================================
-- Migration: Add ita_sales and ita_payments tables
-- Supports Weekly ITA Sales & Payment Calculation System
-- ============================================

CREATE TABLE IF NOT EXISTS ita_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  sale_date DATE NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  rate_per_thousand NUMERIC NOT NULL CHECK (rate_per_thousand >= 0),
  sales_amount NUMERIC NOT NULL CHECK (sales_amount >= 0),
  note TEXT,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ita_sales_person_id ON ita_sales(person_id);
CREATE INDEX IF NOT EXISTS idx_ita_sales_user_id ON ita_sales(user_id);
CREATE INDEX IF NOT EXISTS idx_ita_sales_sale_date ON ita_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_ita_sales_week_start ON ita_sales(week_start_date);

ALTER TABLE ita_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ita_sales"
  ON ita_sales FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ita_sales"
  ON ita_sales FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ita_sales"
  ON ita_sales FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ita_sales"
  ON ita_sales FOR DELETE
  USING (auth.uid() = user_id);

-- Payments allocated to a specific week for an ita_sell person
CREATE TABLE IF NOT EXISTS ita_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  note TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ita_payments_person_id ON ita_payments(person_id);
CREATE INDEX IF NOT EXISTS idx_ita_payments_user_id ON ita_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_ita_payments_payment_date ON ita_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_ita_payments_week_start ON ita_payments(week_start_date);

ALTER TABLE ita_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ita_payments"
  ON ita_payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ita_payments"
  ON ita_payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ita_payments"
  ON ita_payments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ita_payments"
  ON ita_payments FOR DELETE
  USING (auth.uid() = user_id);

