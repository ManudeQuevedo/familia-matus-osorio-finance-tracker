-- Minimal patch if ONLY expense_records.expense_type is missing.
-- Prefer running the full sql/expense_structure_migration.sql so recurring_expenses,
-- variable_expenses, and classification tables stay in sync with the app.

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
