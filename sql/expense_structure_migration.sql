-- =============================================================================
-- FINANCE: expense types migration — REQUIRED for /expenses + dashboard.
--
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste this file → Run.
--
-- If your app errors with: "column expense_records.expense_type does not exist"
-- you have not applied this migration yet (or it failed partway — fix errors, re-run).
--
-- Safe to re-run: uses IF NOT EXISTS / DROP CONSTRAINT IF EXISTS where needed.
-- =============================================================================

-- Expense types: recurring / planned / unplanned / unexpected

-- -----------------------------------------------------------------------------
-- expense_records.expense_type + optional classification FKs
-- -----------------------------------------------------------------------------
ALTER TABLE public.expense_records
  ADD COLUMN IF NOT EXISTS expense_type text DEFAULT 'recurring';

ALTER TABLE public.expense_records
  DROP CONSTRAINT IF EXISTS expense_records_expense_type_check;

ALTER TABLE public.expense_records
  ADD CONSTRAINT expense_records_expense_type_check
  CHECK (expense_type IN ('recurring', 'planned', 'unplanned', 'unexpected'));

UPDATE public.expense_records
SET expense_type = 'recurring'
WHERE expense_type IS NULL;

ALTER TABLE public.expense_records
  ADD COLUMN IF NOT EXISTS unexpected_type_id uuid;

ALTER TABLE public.expense_records
  ADD COLUMN IF NOT EXISTS unplanned_type_id uuid;

-- -----------------------------------------------------------------------------
-- recurring_expenses.frequency + template_kind (recurring vs planned template)
-- -----------------------------------------------------------------------------
ALTER TABLE public.recurring_expenses
  ADD COLUMN IF NOT EXISTS frequency text DEFAULT 'monthly';

ALTER TABLE public.recurring_expenses
  DROP CONSTRAINT IF EXISTS recurring_expenses_frequency_check;

ALTER TABLE public.recurring_expenses
  ADD CONSTRAINT recurring_expenses_frequency_check
  CHECK (frequency IN ('monthly', 'bimonthly', 'annual', 'unique'));

ALTER TABLE public.recurring_expenses
  ADD COLUMN IF NOT EXISTS template_kind text DEFAULT 'recurring';

ALTER TABLE public.recurring_expenses
  DROP CONSTRAINT IF EXISTS recurring_expenses_template_kind_check;

ALTER TABLE public.recurring_expenses
  ADD CONSTRAINT recurring_expenses_template_kind_check
  CHECK (template_kind IN ('recurring', 'planned'));

UPDATE public.recurring_expenses SET frequency = 'monthly' WHERE frequency IS NULL;
UPDATE public.recurring_expenses SET template_kind = 'recurring' WHERE template_kind IS NULL;

-- -----------------------------------------------------------------------------
-- variable_expenses.classification (only unplanned / unexpected in app)
-- -----------------------------------------------------------------------------
ALTER TABLE public.variable_expenses
  ADD COLUMN IF NOT EXISTS expense_type text DEFAULT 'unplanned';

ALTER TABLE public.variable_expenses
  DROP CONSTRAINT IF EXISTS variable_expenses_expense_type_check;

ALTER TABLE public.variable_expenses
  ADD CONSTRAINT variable_expenses_expense_type_check
  CHECK (expense_type IN ('unplanned', 'unexpected'));

UPDATE public.variable_expenses SET expense_type = 'unplanned' WHERE expense_type IS NULL;

ALTER TABLE public.variable_expenses
  ADD COLUMN IF NOT EXISTS type_id uuid;

ALTER TABLE public.variable_expenses
  ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.family_group (id) ON DELETE CASCADE;

ALTER TABLE public.variable_expenses
  ADD COLUMN IF NOT EXISTS permanent_solution boolean DEFAULT false;

ALTER TABLE public.variable_expenses
  ADD COLUMN IF NOT EXISTS permanent_solution_note text;

-- -----------------------------------------------------------------------------
-- Classification tables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.unexpected_expense_types (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id uuid NOT NULL REFERENCES public.family_group (id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.unplanned_expense_types (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id uuid NOT NULL REFERENCES public.family_group (id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.unexpected_expense_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unplanned_expense_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Family members manage unexpected types" ON public.unexpected_expense_types;
CREATE POLICY "Family members manage unexpected types"
ON public.unexpected_expense_types FOR ALL TO authenticated
USING (
  family_id IN (
    SELECT family_id FROM public.family_members
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  family_id IN (
    SELECT family_id FROM public.family_members
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Family members manage unplanned types" ON public.unplanned_expense_types;
CREATE POLICY "Family members manage unplanned types"
ON public.unplanned_expense_types FOR ALL TO authenticated
USING (
  family_id IN (
    SELECT family_id FROM public.family_members
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  family_id IN (
    SELECT family_id FROM public.family_members
    WHERE user_id = auth.uid()
  )
);

-- Seed system rows once per family (Spanish copy per product default)
INSERT INTO public.unexpected_expense_types (family_id, name, icon, is_system)
SELECT fg.id, v.name, v.icon, true
FROM public.family_group fg
CROSS JOIN (
  VALUES
    ('Salud', 'heart-pulse'),
    ('Arreglo de coche', 'car'),
    ('Reparación del hogar', 'wrench'),
    ('Emergencia familiar', 'users'),
    ('Veterinario', 'paw-print'),
    ('Legal', 'scale')
) AS v(name, icon)
WHERE NOT EXISTS (
  SELECT 1 FROM public.unexpected_expense_types t
  WHERE t.family_id = fg.id AND t.name = v.name AND t.is_system = true
);

INSERT INTO public.unplanned_expense_types (family_id, name, icon, is_system)
SELECT fg.id, v.name, v.icon, true
FROM public.family_group fg
CROSS JOIN (
  VALUES
    ('Comida fuera', 'utensils'),
    ('Playground', 'ferris-wheel'),
    ('Cine', 'film'),
    ('Compras', 'shopping-bag'),
    ('Entretenimiento', 'gamepad-2'),
    ('Antojo', 'coffee'),
    ('Transporte extra', 'car')
) AS v(name, icon)
WHERE NOT EXISTS (
  SELECT 1 FROM public.unplanned_expense_types t
  WHERE t.family_id = fg.id AND t.name = v.name AND t.is_system = true
);
