export const SUPABASE_SCHEMA_SQL = `-- ============================================
-- Brick Kiln Hisab Management System
-- Complete Database Schema
-- ============================================

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. PERSONS TABLE
CREATE TABLE IF NOT EXISTS persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('labour', 'ita_sell', 'koila', 'kamin', 'sordar', 'ita_khola')),
  phone TEXT,
  address TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_persons_user_id ON persons(user_id);
CREATE INDEX IF NOT EXISTS idx_persons_category ON persons(category);
CREATE INDEX IF NOT EXISTS idx_persons_name ON persons(name);

ALTER TABLE persons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own persons"
  ON persons FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own persons"
  ON persons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own persons"
  ON persons FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own persons"
  ON persons FOR DELETE
  USING (auth.uid() = user_id);

-- 3. CALCULATIONS TABLE
CREATE TABLE IF NOT EXISTS calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  calc_type TEXT NOT NULL CHECK (calc_type IN ('quantity', 'money')),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calculations_person_id ON calculations(person_id);
CREATE INDEX IF NOT EXISTS idx_calculations_user_id ON calculations(user_id);

ALTER TABLE calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own calculations"
  ON calculations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calculations"
  ON calculations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calculations"
  ON calculations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calculations"
  ON calculations FOR DELETE
  USING (auth.uid() = user_id);

-- 4. ENTRIES TABLE
CREATE TABLE IF NOT EXISTS entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calculation_id UUID NOT NULL REFERENCES calculations(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  quantity NUMERIC,
  amount NUMERIC,
  transaction_type TEXT CHECK (
    transaction_type IS NULL OR
    transaction_type IN ('i_will_receive', 'they_paid_me', 'i_paid_them', 'i_have_to_pay')
  ),
  description TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entries_calculation_id ON entries(calculation_id);
CREATE INDEX IF NOT EXISTS idx_entries_person_id ON entries(person_id);
CREATE INDEX IF NOT EXISTS idx_entries_user_id ON entries(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_entry_date ON entries(entry_date);

ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own entries"
  ON entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entries"
  ON entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own entries"
  ON entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own entries"
  ON entries FOR DELETE
  USING (auth.uid() = user_id);

-- 5. APP_SETTINGS TABLE
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  allow_edit BOOLEAN DEFAULT FALSE,
  allow_delete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
  ON app_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON app_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON app_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- 6. AUDIT_LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 7. HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION get_person_financial_summary(p_person_id UUID)
RETURNS TABLE (
  total_receivable NUMERIC,
  total_received NUMERIC,
  total_payable NUMERIC,
  total_paid NUMERIC,
  net_balance NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN e.transaction_type = 'i_will_receive' THEN e.amount ELSE 0 END), 0) AS total_receivable,
    COALESCE(SUM(CASE WHEN e.transaction_type = 'they_paid_me' THEN e.amount ELSE 0 END), 0) AS total_received,
    COALESCE(SUM(CASE WHEN e.transaction_type = 'i_have_to_pay' THEN e.amount ELSE 0 END), 0) AS total_payable,
    COALESCE(SUM(CASE WHEN e.transaction_type = 'i_paid_them' THEN e.amount ELSE 0 END), 0) AS total_paid,
    (
      COALESCE(SUM(CASE WHEN e.transaction_type = 'i_will_receive' THEN e.amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN e.transaction_type = 'they_paid_me' THEN e.amount ELSE 0 END), 0)
    ) - (
      COALESCE(SUM(CASE WHEN e.transaction_type = 'i_have_to_pay' THEN e.amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN e.transaction_type = 'i_paid_them' THEN e.amount ELSE 0 END), 0)
    ) AS net_balance
  FROM entries e
  JOIN calculations c ON e.calculation_id = c.id
  WHERE e.person_id = p_person_id
    AND c.calc_type = 'money'
    AND e.is_deleted = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. ITA SALES & PAYMENTS TABLES
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
  source_entry_id UUID UNIQUE,
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

CREATE TABLE IF NOT EXISTS ita_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  source_entry_id UUID UNIQUE,
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
`
