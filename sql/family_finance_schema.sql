-- =============================================================================
-- Family Finance (MXN) — Supabase PostgreSQL
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- IMPORTANTE (usuarios fijos):
-- 1) Crea primero las cuentas en Authentication (solo estos correos):
--    - manuel.matusdequevedo@gmail.com
--    - carolina.matus.osorio@gmail.com
-- 2) El trigger "on_auth_user_created" creará la fila en public.profiles.
-- 3) Opcional: bloqueo de registro (BLOQUE FINAL). En proyectos hosted a veces
--    no tienes permisos para TRIGGER en auth.users; si falla, desactiva esa
--    sección y restringe altas vía Dashboard / Edge Function.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- EXTENSIONS
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- TYPES (CHECK constraints en tablas para mantener un solo script portable)
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 1) PROFILES (extiende auth.users)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'es' CHECK (preferred_language IN ('es', 'en')),
  preferred_theme TEXT NOT NULL DEFAULT 'system' CHECK (preferred_theme IN ('light', 'dark', 'system')),
  accent_color TEXT NOT NULL DEFAULT 'emerald' CHECK (accent_color IN ('emerald', 'blue', 'purple', 'rose', 'amber', 'slate')),
  currency_display TEXT NOT NULL DEFAULT 'MXN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles (lower(email));

COMMENT ON TABLE public.profiles IS 'Perfil de usuario; id = auth.users.id';

-- -----------------------------------------------------------------------------
-- 2) ACCOUNTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('savings', 'checking', 'cash')),
  color TEXT NOT NULL DEFAULT '#6366f1',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS accounts_user_id_idx ON public.accounts (user_id);

-- -----------------------------------------------------------------------------
-- 3) CATEGORIES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_es TEXT NOT NULL,
  name_en TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'circle',
  color TEXT NOT NULL DEFAULT '#64748b',
  type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'both')),
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS categories_type_idx ON public.categories (type);

-- -----------------------------------------------------------------------------
-- 4) SUBCATEGORIES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subcategories_category_id_idx ON public.subcategories (category_id);

-- -----------------------------------------------------------------------------
-- 5) RECURRING_EXPENSES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recurring_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  subcategory_id UUID NOT NULL REFERENCES public.subcategories (id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES public.accounts (id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  paycheck_period SMALLINT NOT NULL CHECK (paycheck_period IN (1, 2)),
  due_day SMALLINT CHECK (due_day IS NULL OR (due_day >= 1 AND due_day <= 31)),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recurring_expenses_user_idx ON public.recurring_expenses (user_id);

COMMENT ON COLUMN public.recurring_expenses.paycheck_period IS 'Según tu regla: 1 = Paycheck 1 (días 15–30), 2 = Paycheck 2 (días 1–15)';
COMMENT ON COLUMN public.recurring_expenses.due_day IS 'Día del mes; NULL = aplica en cada quincena de ese paycheck_period';

-- -----------------------------------------------------------------------------
-- 6) EXPENSE_RECORDS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expense_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_expense_id UUID REFERENCES public.recurring_expenses (id) ON DELETE SET NULL,
  subcategory_id UUID NOT NULL REFERENCES public.subcategories (id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES public.accounts (id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  name TEXT NOT NULL,
  notes TEXT,
  period_year SMALLINT NOT NULL CHECK (period_year >= 2000 AND period_year <= 2100),
  period_month SMALLINT NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  paycheck_period SMALLINT NOT NULL CHECK (paycheck_period IN (1, 2)),
  due_date DATE NOT NULL,
  paid_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('paid', 'pending', 'overdue')),
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expense_records_user_period_idx
  ON public.expense_records (user_id, period_year, period_month, paycheck_period);

COMMENT ON COLUMN public.expense_records.paycheck_period IS '1 = Paycheck 1 (días 15–30), 2 = Paycheck 2 (días 1–15)';

-- -----------------------------------------------------------------------------
-- 7) VARIABLE_EXPENSES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.variable_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories (id) ON DELETE RESTRICT,
  subcategory_id UUID REFERENCES public.subcategories (id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  description TEXT NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS variable_expenses_user_date_idx ON public.variable_expenses (user_id, date);

-- -----------------------------------------------------------------------------
-- 8) INCOMES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts (id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('salary', 'bonus', 'other')),
  amount_mxn NUMERIC(12, 2) NOT NULL CHECK (amount_mxn >= 0),
  amount_original NUMERIC(12, 2),
  original_currency TEXT NOT NULL DEFAULT 'MXN' CHECK (original_currency IN ('MXN', 'USD')),
  exchange_rate_used NUMERIC(8, 4),
  period_year SMALLINT NOT NULL,
  period_month SMALLINT NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  paycheck_number SMALLINT CHECK (paycheck_number IS NULL OR paycheck_number IN (1, 2)),
  received_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS incomes_user_period_idx ON public.incomes (user_id, period_year, period_month);

-- -----------------------------------------------------------------------------
-- 9) GOALS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  shared_goal BOOLEAN NOT NULL DEFAULT false,
  title TEXT NOT NULL,
  description TEXT,
  target_amount NUMERIC(12, 2) NOT NULL CHECK (target_amount >= 0),
  current_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  target_date DATE NOT NULL,
  monthly_required NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  icon TEXT NOT NULL DEFAULT 'target',
  color TEXT NOT NULL DEFAULT '#22c55e',
  ai_suggestions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS goals_user_idx ON public.goals (user_id);
CREATE INDEX IF NOT EXISTS goals_shared_idx ON public.goals (shared_goal) WHERE shared_goal = true;

COMMENT ON COLUMN public.goals.monthly_required IS 'Monto mensual sugerido/requerido (calculado en la app y persistido)';
COMMENT ON COLUMN public.goals.ai_suggestions IS 'Respuestas o metadatos de Claude (JSON)';

-- -----------------------------------------------------------------------------
-- 10) GOAL_CONTRIBUTIONS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goal_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS goal_contributions_goal_idx ON public.goal_contributions (goal_id);

-- -----------------------------------------------------------------------------
-- 11) DEBTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
  current_balance NUMERIC(12, 2) NOT NULL CHECK (current_balance >= 0),
  monthly_payment NUMERIC(12, 2) NOT NULL CHECK (monthly_payment >= 0),
  interest_rate NUMERIC(5, 2),
  due_day SMALLINT NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
  start_date DATE NOT NULL,
  estimated_payoff_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paid_off')),
  ai_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS debts_user_idx ON public.debts (user_id);

-- -----------------------------------------------------------------------------
-- 12) DEBT_PAYMENTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.debt_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID NOT NULL REFERENCES public.debts (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  amount_paid NUMERIC(12, 2) NOT NULL CHECK (amount_paid >= 0),
  payment_date DATE NOT NULL,
  balance_after NUMERIC(12, 2) NOT NULL CHECK (balance_after >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS debt_payments_debt_idx ON public.debt_payments (debt_id);

-- =============================================================================
-- FUNCIONES: updated_at + perfil al registrarse
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS 'Actualiza updated_at en BEFORE UPDATE';

-- Perfil automático al crear usuario en Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'avatar_url', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();

-- updated_at en tablas que lo tienen
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS trg_expense_records_updated_at ON public.expense_records;
CREATE TRIGGER trg_expense_records_updated_at
  BEFORE UPDATE ON public.expense_records
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS trg_goals_updated_at ON public.goals;
CREATE TRIGGER trg_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS trg_debts_updated_at ON public.debts;
CREATE TRIGGER trg_debts_updated_at
  BEFORE UPDATE ON public.debts
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

-- =============================================================================
-- RLS: habilitar en todas las tablas
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variable_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- POLICIES: profiles
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- INSERT lo hace el trigger de auth (service role); usuarios no insertan profiles manualmente

-- -----------------------------------------------------------------------------
-- POLICIES: accounts, recurring, expense_records, variable, incomes, debts, payments
-- Patrón: user_id = auth.uid()
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "accounts_all_own" ON public.accounts;
CREATE POLICY "accounts_all_own"
  ON public.accounts FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "recurring_all_own" ON public.recurring_expenses;
CREATE POLICY "recurring_all_own"
  ON public.recurring_expenses FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "expense_records_all_own" ON public.expense_records;
CREATE POLICY "expense_records_all_own"
  ON public.expense_records FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "variable_expenses_all_own" ON public.variable_expenses;
CREATE POLICY "variable_expenses_all_own"
  ON public.variable_expenses FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "incomes_all_own" ON public.incomes;
CREATE POLICY "incomes_all_own"
  ON public.incomes FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "debts_all_own" ON public.debts;
CREATE POLICY "debts_all_own"
  ON public.debts FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "debt_payments_all_own" ON public.debt_payments;
CREATE POLICY "debt_payments_all_own"
  ON public.debt_payments FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- POLICIES: goals (propios + compartidos lectura; escritura solo propietario)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "goals_select_visible" ON public.goals;
CREATE POLICY "goals_select_visible"
  ON public.goals FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR shared_goal = true);

DROP POLICY IF EXISTS "goals_insert_own" ON public.goals;
CREATE POLICY "goals_insert_own"
  ON public.goals FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "goals_update_owner" ON public.goals;
CREATE POLICY "goals_update_owner"
  ON public.goals FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "goals_delete_owner" ON public.goals;
CREATE POLICY "goals_delete_owner"
  ON public.goals FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- POLICIES: goal_contributions (visible si ves el goal; solo aportas como tú)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "goal_contributions_select" ON public.goal_contributions;
CREATE POLICY "goal_contributions_select"
  ON public.goal_contributions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = goal_contributions.goal_id
        AND (g.user_id = auth.uid() OR g.shared_goal = true)
    )
  );

DROP POLICY IF EXISTS "goal_contributions_insert" ON public.goal_contributions;
CREATE POLICY "goal_contributions_insert"
  ON public.goal_contributions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = goal_id
        AND (g.user_id = auth.uid() OR g.shared_goal = true)
    )
  );

DROP POLICY IF EXISTS "goal_contributions_update_own" ON public.goal_contributions;
CREATE POLICY "goal_contributions_update_own"
  ON public.goal_contributions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "goal_contributions_delete_own" ON public.goal_contributions;
CREATE POLICY "goal_contributions_delete_own"
  ON public.goal_contributions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- POLICIES: categories & subcategories — lectura para autenticados
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "categories_select_auth" ON public.categories;
CREATE POLICY "categories_select_auth"
  ON public.categories FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "subcategories_select_auth" ON public.subcategories;
CREATE POLICY "subcategories_select_auth"
  ON public.subcategories FOR SELECT
  TO authenticated
  USING (true);

-- Sin políticas de escritura para usuarios: categorías sistema + seed por SQL/service role.
-- Si más adelante quieres categorías custom por usuario, añade user_id y políticas nuevas.

-- =============================================================================
-- SEED: categorías sistema (idempotente: no duplica name_en)
-- =============================================================================

INSERT INTO public.categories (name_es, name_en, icon, color, type, is_system)
SELECT name_es, name_en, icon, color, type, is_system
FROM (VALUES
  ('Vivienda', 'Housing', 'home', '#0ea5e9', 'expense', true),
  ('Educación', 'Education', 'graduation-cap', '#8b5cf6', 'expense', true),
  ('Transporte', 'Transportation', 'car', '#f97316', 'expense', true),
  ('Deporte y actividades', 'Sport & Activities', 'dumbbell', '#22c55e', 'expense', true),
  ('Suscripciones', 'Subscriptions', 'credit-card', '#ec4899', 'expense', true),
  ('Deudas', 'Debt', 'landmark', '#ef4444', 'expense', true),
  ('Inversiones', 'Investments', 'trending-up', '#14b8a6', 'both', true),
  ('Gastos hormiga', 'Gastos hormiga', 'ant', '#a855f7', 'expense', true),
  ('Gastos inesperados', 'Unexpected expenses', 'alert-circle', '#eab308', 'expense', true)
) AS t(name_es, name_en, icon, color, type, is_system)
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories c WHERE c.name_en = t.name_en
);

-- =============================================================================
-- SEED: subcategorías (busca category_id por name_en)
-- =============================================================================

INSERT INTO public.subcategories (category_id, name, description, is_active)
SELECT c.id, v.name, v.description, true
FROM public.categories c
JOIN (VALUES
  -- Housing
  ('Housing', 'Mortgage', 'Hipoteca'),
  ('Housing', 'Groceries', 'Supermercado'),
  ('Housing', 'CFE/Electricity', 'Electricidad CFE'),
  ('Housing', 'Engie (gas)', 'Gas Engie'),
  ('Housing', 'Bebbia Water', 'Agua Bebbia'),
  ('Housing', 'Saltamontes & Water', 'Saltamontes y agua'),
  -- Education
  ('Education', 'JFK (colegio)', 'Colegio JFK'),
  -- Transportation
  ('Transportation', 'Car Gas', 'Gasolina auto'),
  ('Transportation', 'Car Insurance', 'Seguro del auto'),
  -- Sport
  ('Sport & Activities', 'Robotics & Cheerleading', NULL),
  ('Sport & Activities', 'Gymnastics Class', 'Clase de gimnasia'),
  -- Subscriptions
  ('Subscriptions', 'Carolina AT&T', NULL),
  ('Subscriptions', 'Bear AT&T', NULL),
  ('Subscriptions', 'Netflix', NULL),
  ('Subscriptions', 'HBO', NULL),
  ('Subscriptions', 'Google Office Carolina', NULL),
  ('Subscriptions', 'Google Office Bear', NULL),
  ('Subscriptions', 'Prime', 'Amazon Prime'),
  ('Subscriptions', 'Telmex/Disney', NULL),
  ('Subscriptions', 'iCloud', NULL),
  ('Subscriptions', 'Apple Music', NULL),
  ('Subscriptions', 'PlayStation Plus', NULL),
  ('Subscriptions', 'SkyLight App', NULL),
  -- Debt
  ('Debt', 'Carolina Personal Loan BBVA', NULL),
  ('Debt', 'Carolina Credit Card BBVA', NULL),
  ('Debt', 'American Express', NULL),
  -- Investments
  ('Investments', 'Retirement Fund', 'Fondo retiro'),
  ('Investments', 'Hayley''s College Fund', 'Fondo universidad Hayley')
) AS v(cat_en, name, description)
  ON c.name_en = v.cat_en
WHERE NOT EXISTS (
  SELECT 1 FROM public.subcategories s
  WHERE s.category_id = c.id AND s.name = v.name
);

-- =============================================================================
-- OPCIONAL: restringir altas en auth.users a los 2 correos (puede requerir rol elevado)
-- Si falla al ejecutar, omite este bloque y controla invitaciones en Dashboard.
-- =============================================================================
/*
CREATE OR REPLACE FUNCTION public.restrict_auth_users_to_household()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND lower(NEW.email) NOT IN (
    'manuel.matusdequevedo@gmail.com',
    'carolina.matus.osorio@gmail.com'
  ) THEN
    RAISE EXCEPTION 'Only household emails are allowed: %', NEW.email;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_household_emails ON auth.users;
CREATE TRIGGER trg_restrict_household_emails
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.restrict_auth_users_to_household();
*/

-- =============================================================================
-- FIN
-- =============================================================================
