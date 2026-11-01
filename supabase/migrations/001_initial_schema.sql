-- ============================================
-- Brick Kiln Hisab Management System
-- Complete Database Schema
-- ============================================

-- 1. PROFILES TABLE
-- Stores user profile information linked to Supabase Auth
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
-- Stores all persons across all categories
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

CREATE INDEX idx_persons_user_id ON persons(user_id);
CREATE INDEX idx_persons_category ON persons(category);
CREATE INDEX idx_persons_name ON persons(name);

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
-- Each person can have unlimited independent calculation sections
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

CREATE INDEX idx_calculations_person_id ON calculations(person_id);
CREATE INDEX idx_calculations_user_id ON calculations(user_id);

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
-- Stores all transaction entries for all calculation sections
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

CREATE INDEX idx_entries_calculation_id ON entries(calculation_id);
CREATE INDEX idx_entries_person_id ON entries(person_id);
CREATE INDEX idx_entries_user_id ON entries(user_id);
CREATE INDEX idx_entries_entry_date ON entries(entry_date);

ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own entries"
  ON entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entries"
  ON entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Update and Delete policies respect app_settings
CREATE POLICY "Users can update own entries"
  ON entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own entries"
  ON entries FOR DELETE
  USING (auth.uid() = user_id);

-- 5. APP_SETTINGS TABLE
-- Stores user-specific application settings
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
-- Records all modifications for accountability
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

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_record_id ON audit_logs(record_id);
CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- TRIGGER FUNCTIONS FOR AUDIT LOGGING
-- ============================================

CREATE OR REPLACE FUNCTION log_entry_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (user_id, table_name, record_id, action, old_values, new_values)
    VALUES (
      auth.uid(),
      TG_TABLE_NAME,
      OLD.id,
      'UPDATE',
      row_to_json(OLD)::jsonb,
      row_to_json(NEW)::jsonb
    );
    NEW.updated_at = NOW();
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (user_id, table_name, record_id, action, old_values, new_values)
    VALUES (
      auth.uid(),
      TG_TABLE_NAME,
      OLD.id,
      'DELETE',
      row_to_json(OLD)::jsonb,
      NULL
    );
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (user_id, table_name, record_id, action, old_values, new_values)
    VALUES (
      auth.uid(),
      TG_TABLE_NAME,
      NEW.id,
      'INSERT',
      NULL,
      row_to_json(NEW)::jsonb
    );
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER entries_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON entries
  FOR EACH ROW EXECUTE FUNCTION log_entry_changes();

CREATE TRIGGER persons_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON persons
  FOR EACH ROW EXECUTE FUNCTION log_entry_changes();

CREATE TRIGGER calculations_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON calculations
  FOR EACH ROW EXECUTE FUNCTION log_entry_changes();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if user can edit entries
CREATE OR REPLACE FUNCTION can_edit_entries(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_allow BOOLEAN;
BEGIN
  SELECT allow_edit INTO v_allow FROM app_settings WHERE user_id = p_user_id;
  RETURN COALESCE(v_allow, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can delete entries
CREATE OR REPLACE FUNCTION can_delete_entries(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_allow BOOLEAN;
BEGIN
  SELECT allow_delete INTO v_allow FROM app_settings WHERE user_id = p_user_id;
  RETURN COALESCE(v_allow, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get person financial summary
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

-- Function to initialize default settings for a user
CREATE OR REPLACE FUNCTION initialize_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO app_settings (user_id, allow_edit, allow_delete)
  VALUES (NEW.id, FALSE, FALSE)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_settings_init ON auth.users;
CREATE TRIGGER on_user_settings_init
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION initialize_user_settings();
