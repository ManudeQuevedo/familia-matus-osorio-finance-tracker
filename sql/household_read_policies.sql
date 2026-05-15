-- Household read access: both authenticated users can read each other's
-- incomes and expenses for family totals. Run once in Supabase SQL Editor.

DROP POLICY IF EXISTS "incomes_select_household" ON public.incomes;
CREATE POLICY "incomes_select_household"
  ON public.incomes FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM public.profiles
      WHERE lower(email) IN (
        'manuel.matusdequevedo@gmail.com',
        'carolina.matus.osorio@gmail.com'
      )
    )
  );

DROP POLICY IF EXISTS "expense_records_select_household" ON public.expense_records;
CREATE POLICY "expense_records_select_household"
  ON public.expense_records FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM public.profiles
      WHERE lower(email) IN (
        'manuel.matusdequevedo@gmail.com',
        'carolina.matus.osorio@gmail.com'
      )
    )
  );

DROP POLICY IF EXISTS "variable_expenses_select_household" ON public.variable_expenses;
CREATE POLICY "variable_expenses_select_household"
  ON public.variable_expenses FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM public.profiles
      WHERE lower(email) IN (
        'manuel.matusdequevedo@gmail.com',
        'carolina.matus.osorio@gmail.com'
      )
    )
  );

DROP POLICY IF EXISTS "profiles_select_household" ON public.profiles;
CREATE POLICY "profiles_select_household"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    lower(email) IN (
      'manuel.matusdequevedo@gmail.com',
      'carolina.matus.osorio@gmail.com'
    )
  );

DROP POLICY IF EXISTS "incomes_insert_household" ON public.incomes;
CREATE POLICY "incomes_insert_household"
  ON public.incomes FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IN (
      SELECT id FROM public.profiles
      WHERE lower(email) IN (
        'manuel.matusdequevedo@gmail.com',
        'carolina.matus.osorio@gmail.com'
      )
    )
  );

-- Household read: goals, debts, contributions, payments
DROP POLICY IF EXISTS "goals_select_household" ON public.goals;
CREATE POLICY "goals_select_household"
  ON public.goals FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM public.profiles
      WHERE lower(email) IN (
        'manuel.matusdequevedo@gmail.com',
        'carolina.matus.osorio@gmail.com'
      )
    )
  );

DROP POLICY IF EXISTS "debts_select_household" ON public.debts;
CREATE POLICY "debts_select_household"
  ON public.debts FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM public.profiles
      WHERE lower(email) IN (
        'manuel.matusdequevedo@gmail.com',
        'carolina.matus.osorio@gmail.com'
      )
    )
  );

DROP POLICY IF EXISTS "goal_contributions_select_household" ON public.goal_contributions;
CREATE POLICY "goal_contributions_select_household"
  ON public.goal_contributions FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM public.profiles
      WHERE lower(email) IN (
        'manuel.matusdequevedo@gmail.com',
        'carolina.matus.osorio@gmail.com'
      )
    )
  );

DROP POLICY IF EXISTS "debt_payments_select_household" ON public.debt_payments;
CREATE POLICY "debt_payments_select_household"
  ON public.debt_payments FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM public.profiles
      WHERE lower(email) IN (
        'manuel.matusdequevedo@gmail.com',
        'carolina.matus.osorio@gmail.com'
      )
    )
  );
