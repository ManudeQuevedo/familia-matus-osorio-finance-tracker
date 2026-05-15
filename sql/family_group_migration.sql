  -- =============================================================================
  -- Family group + shared financial data — run in Supabase SQL Editor AFTER
  -- family_finance_schema.sql, household_read_policies.sql, notes_schema.sql,
  -- and settings_subcategories_policies.sql.
  --
  -- 1. Creates family_group + family_members (UUID fijo por idempotencia).
  -- 2. Adds family_id to finance + notes (+ subcategories) and backfills.
  -- 3. Replaces legacy RLS (per-user / email household hacks) with family-based
  --    policies so any member sees and edits ALL family rows.
  --
  -- Habilitación Realtime en el Dashboard para tablas públicas financieras
  -- (para suscripciones en la app web).
  -- =============================================================================

  -- Familia determinística (UUID fijo) en INSERT/UPDATE más abajo — cámbiala si recreas el grupo.

  -- -----------------------------------------------------------------------------
  -- Tables
  -- -----------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS public.family_group (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'Familia Matus Osorio',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS public.family_members (
    user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    family_id UUID NOT NULL REFERENCES public.family_group (id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, family_id)
  );

  CREATE INDEX IF NOT EXISTS family_members_family_id_idx ON public.family_members (family_id);

  COMMENT ON TABLE public.family_group IS 'Un hogar/compartimiento financiero.';
  COMMENT ON TABLE public.family_members IS 'auth.users/profile -> family membership.';

  ALTER TABLE public.family_group ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "family_group_select_member" ON public.family_group;
  CREATE POLICY "family_group_select_member"
    ON public.family_group FOR SELECT
    TO authenticated
    USING (
      id IN (
        SELECT fm.family_id FROM public.family_members fm
        WHERE fm.user_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "family_members_select_same_family" ON public.family_members;
  CREATE POLICY "family_members_select_same_family"
    ON public.family_members FOR SELECT
    TO authenticated
    USING (
      family_id IN (
        SELECT fm.family_id FROM public.family_members fm
        WHERE fm.user_id = auth.uid()
      )
    );

  -- No INSERT/UPDATE/DELETE for authenticated on membership (solo SQL / service).

  -- -----------------------------------------------------------------------------
  -- Seed: familia fija + dos perfiles conocidos (ajusta UUID si renombras)
  -- PostgreSQL estándar: sin \set (Supabase puede no tener psql vars). Usamos literal UUID:
  -- -----------------------------------------------------------------------------
  INSERT INTO public.family_group (id, name)
  SELECT 'b2c9f84e-3a1d-42f9-9c71-84e6fb5b2a91'::uuid, 'Familia Matus Osorio'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.family_group WHERE id = 'b2c9f84e-3a1d-42f9-9c71-84e6fb5b2a91'::uuid
  );

  INSERT INTO public.family_members (user_id, family_id)
  SELECT p.id, 'b2c9f84e-3a1d-42f9-9c71-84e6fb5b2a91'::uuid
  FROM public.profiles p
  WHERE lower(p.email) IN (
    'manuel.matusdequevedo@gmail.com',
    'carolina.matus.osorio@gmail.com'
  )
  ON CONFLICT (user_id, family_id) DO NOTHING;

  -- -----------------------------------------------------------------------------
  -- ADD family_id columns (finance + notes + subcategories custom)
  -- -----------------------------------------------------------------------------
  ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.family_group (id);
  ALTER TABLE public.recurring_expenses ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.family_group (id);
  ALTER TABLE public.expense_records ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.family_group (id);
  ALTER TABLE public.variable_expenses ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.family_group (id);
  ALTER TABLE public.incomes ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.family_group (id);
  ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.family_group (id);
  ALTER TABLE public.goal_contributions ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.family_group (id);
  ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.family_group (id);
  ALTER TABLE public.debt_payments ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.family_group (id);
  ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.family_group (id);
  ALTER TABLE public.subcategories ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.family_group (id);

  CREATE INDEX IF NOT EXISTS accounts_family_id_idx ON public.accounts (family_id);
  CREATE INDEX IF NOT EXISTS recurring_expenses_family_id_idx ON public.recurring_expenses (family_id);
  CREATE INDEX IF NOT EXISTS expense_records_family_id_idx ON public.expense_records (family_id);
  CREATE INDEX IF NOT EXISTS variable_expenses_family_id_idx ON public.variable_expenses (family_id);
  CREATE INDEX IF NOT EXISTS incomes_family_id_idx ON public.incomes (family_id);
  CREATE INDEX IF NOT EXISTS goals_family_id_idx ON public.goals (family_id);
  CREATE INDEX IF NOT EXISTS goal_contributions_family_id_idx ON public.goal_contributions (family_id);
  CREATE INDEX IF NOT EXISTS debts_family_id_idx ON public.debts (family_id);
  CREATE INDEX IF NOT EXISTS debt_payments_family_id_idx ON public.debt_payments (family_id);
  CREATE INDEX IF NOT EXISTS notes_family_id_idx ON public.notes (family_id);
  CREATE INDEX IF NOT EXISTS subcategories_family_id_idx ON public.subcategories (family_id);

  -- -----------------------------------------------------------------------------
  -- Backfill from fixed family UUID
  -- -----------------------------------------------------------------------------
  UPDATE public.accounts SET family_id = 'b2c9f84e-3a1d-42f9-9c71-84e6fb5b2a91'::uuid WHERE family_id IS NULL;
  UPDATE public.recurring_expenses SET family_id = 'b2c9f84e-3a1d-42f9-9c71-84e6fb5b2a91'::uuid WHERE family_id IS NULL;
  UPDATE public.expense_records SET family_id = 'b2c9f84e-3a1d-42f9-9c71-84e6fb5b2a91'::uuid WHERE family_id IS NULL;
  UPDATE public.variable_expenses SET family_id = 'b2c9f84e-3a1d-42f9-9c71-84e6fb5b2a91'::uuid WHERE family_id IS NULL;
  UPDATE public.incomes SET family_id = 'b2c9f84e-3a1d-42f9-9c71-84e6fb5b2a91'::uuid WHERE family_id IS NULL;
  UPDATE public.goals SET family_id = 'b2c9f84e-3a1d-42f9-9c71-84e6fb5b2a91'::uuid WHERE family_id IS NULL;
  UPDATE public.goal_contributions SET family_id = 'b2c9f84e-3a1d-42f9-9c71-84e6fb5b2a91'::uuid WHERE family_id IS NULL;
  UPDATE public.debts SET family_id = 'b2c9f84e-3a1d-42f9-9c71-84e6fb5b2a91'::uuid WHERE family_id IS NULL;
  UPDATE public.debt_payments SET family_id = 'b2c9f84e-3a1d-42f9-9c71-84e6fb5b2a91'::uuid WHERE family_id IS NULL;
  UPDATE public.notes SET family_id = 'b2c9f84e-3a1d-42f9-9c71-84e6fb5b2a91'::uuid WHERE family_id IS NULL;

  -- Subcategorías personalizadas (user_id no nulo) heredan la familia del dueño
  UPDATE public.subcategories sc
  SET family_id = fm.family_id
  FROM public.family_members fm
  WHERE sc.user_id = fm.user_id AND sc.family_id IS NULL;

  -- -----------------------------------------------------------------------------
  -- Optional NOT NULL (falla si quedan filas sin familia; quita si usas multi-familia)
  -- -----------------------------------------------------------------------------
  -- ALTER TABLE public.accounts ALTER COLUMN family_id SET NOT NULL;
  -- (comentado: descomenta cuando confirmes que no hay NULLs)

  -- -----------------------------------------------------------------------------
  -- Helper for RLS (inline subquery also works)
  -- -----------------------------------------------------------------------------

  -- -----------------------------------------------------------------------------
  -- DROP legacy policies (base schema + household_read_policies + goals split)
  -- -----------------------------------------------------------------------------
  DROP POLICY IF EXISTS "accounts_all_own" ON public.accounts;
  DROP POLICY IF EXISTS "recurring_all_own" ON public.recurring_expenses;
  DROP POLICY IF EXISTS "expense_records_all_own" ON public.expense_records;
  DROP POLICY IF EXISTS "variable_expenses_all_own" ON public.variable_expenses;
  DROP POLICY IF EXISTS "incomes_all_own" ON public.incomes;
  DROP POLICY IF EXISTS "debts_all_own" ON public.debts;
  DROP POLICY IF EXISTS "debt_payments_all_own" ON public.debt_payments;
  DROP POLICY IF EXISTS "goals_select_visible" ON public.goals;
  DROP POLICY IF EXISTS "goals_insert_own" ON public.goals;
  DROP POLICY IF EXISTS "goals_update_owner" ON public.goals;
  DROP POLICY IF EXISTS "goals_delete_owner" ON public.goals;
  DROP POLICY IF EXISTS "goal_contributions_select" ON public.goal_contributions;
  DROP POLICY IF EXISTS "goal_contributions_insert" ON public.goal_contributions;
  DROP POLICY IF EXISTS "goal_contributions_update_own" ON public.goal_contributions;
  DROP POLICY IF EXISTS "goal_contributions_delete_own" ON public.goal_contributions;

  DROP POLICY IF EXISTS "incomes_select_household" ON public.incomes;
  DROP POLICY IF EXISTS "incomes_insert_household" ON public.incomes;
  DROP POLICY IF EXISTS "expense_records_select_household" ON public.expense_records;
  DROP POLICY IF EXISTS "variable_expenses_select_household" ON public.variable_expenses;
  DROP POLICY IF EXISTS "goals_select_household" ON public.goals;
  DROP POLICY IF EXISTS "debts_select_household" ON public.debts;
  DROP POLICY IF EXISTS "goal_contributions_select_household" ON public.goal_contributions;
  DROP POLICY IF EXISTS "debt_payments_select_household" ON public.debt_payments;
  DROP POLICY IF EXISTS "profiles_select_household" ON public.profiles;

  DROP POLICY IF EXISTS "Users can manage their own notes" ON public.notes;

  DROP POLICY IF EXISTS "subcategories_select_auth" ON public.subcategories;
  DROP POLICY IF EXISTS "subcategories_insert_custom" ON public.subcategories;
  DROP POLICY IF EXISTS "subcategories_update_custom" ON public.subcategories;
  DROP POLICY IF EXISTS "subcategories_delete_custom" ON public.subcategories;

  -- -----------------------------------------------------------------------------
  -- profiles: own row + same-family members (reemplaza policies de solo “own” / household)
  -- -----------------------------------------------------------------------------
  DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;

  DROP POLICY IF EXISTS "profiles_select_family" ON public.profiles;
  CREATE POLICY "profiles_select_family"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (
      id = auth.uid()
      OR id IN (
        SELECT fm.user_id FROM public.family_members fm
        WHERE fm.family_id IN (
          SELECT fm2.family_id FROM public.family_members fm2
          WHERE fm2.user_id = auth.uid()
        )
      )
    );

  DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
  CREATE POLICY "profiles_update_own"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

  -- -----------------------------------------------------------------------------
  -- Family-scoped ALL on finance + notes
  -- -----------------------------------------------------------------------------

  DROP POLICY IF EXISTS "family_accounts_all" ON public.accounts;
  CREATE POLICY "family_accounts_all"
    ON public.accounts FOR ALL TO authenticated
    USING (
      family_id IS NOT NULL
      AND family_id IN (
        SELECT fm.family_id FROM public.family_members fm WHERE fm.user_id = auth.uid()
      )
    )
    WITH CHECK (
      family_id IS NOT NULL
      AND family_id IN (
        SELECT fm.family_id FROM public.family_members fm WHERE fm.user_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "family_recurring_expenses_all" ON public.recurring_expenses;
  CREATE POLICY "family_recurring_expenses_all"
    ON public.recurring_expenses FOR ALL TO authenticated
    USING (
      family_id IS NOT NULL
      AND family_id IN (
        SELECT fm.family_id FROM public.family_members fm WHERE fm.user_id = auth.uid()
      )
    )
    WITH CHECK (
      family_id IS NOT NULL
      AND family_id IN (
        SELECT fm.family_id FROM public.family_members fm WHERE fm.user_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "family_expense_records_all" ON public.expense_records;
  CREATE POLICY "family_expense_records_all"
    ON public.expense_records FOR ALL TO authenticated
    USING (
      family_id IS NOT NULL
      AND family_id IN (
        SELECT fm.family_id FROM public.family_members fm WHERE fm.user_id = auth.uid()
      )
    )
    WITH CHECK (
      family_id IS NOT NULL
      AND family_id IN (
        SELECT fm.family_id FROM public.family_members fm WHERE fm.user_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "family_variable_expenses_all" ON public.variable_expenses;
  CREATE POLICY "family_variable_expenses_all"
    ON public.variable_expenses FOR ALL TO authenticated
    USING (
      family_id IS NOT NULL
      AND family_id IN (
        SELECT fm.family_id FROM public.family_members fm WHERE fm.user_id = auth.uid()
      )
    )
    WITH CHECK (
      family_id IS NOT NULL
      AND family_id IN (
        SELECT fm.family_id FROM public.family_members fm WHERE fm.user_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "family_incomes_all" ON public.incomes;
  CREATE POLICY "family_incomes_all"
    ON public.incomes FOR ALL TO authenticated
    USING (
      family_id IS NOT NULL
      AND family_id IN (
        SELECT fm.family_id FROM public.family_members fm WHERE fm.user_id = auth.uid()
      )
    )
    WITH CHECK (
      family_id IS NOT NULL
      AND family_id IN (
        SELECT fm.family_id FROM public.family_members fm WHERE fm.user_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "family_goals_all" ON public.goals;
  CREATE POLICY "family_goals_all"
    ON public.goals FOR ALL TO authenticated
    USING (
      family_id IS NOT NULL
      AND family_id IN (
        SELECT fm.family_id FROM public.family_members fm WHERE fm.user_id = auth.uid()
      )
    )
    WITH CHECK (
      family_id IS NOT NULL
      AND family_id IN (
        SELECT fm.family_id FROM public.family_members fm WHERE fm.user_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "family_goal_contributions_all" ON public.goal_contributions;
  CREATE POLICY "family_goal_contributions_all"
    ON public.goal_contributions FOR ALL TO authenticated
    USING (
      family_id IS NOT NULL
      AND family_id IN (
        SELECT fm.family_id FROM public.family_members fm WHERE fm.user_id = auth.uid()
      )
    )
    WITH CHECK (
      family_id IS NOT NULL
      AND family_id IN (
        SELECT fm.family_id FROM public.family_members fm WHERE fm.user_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "family_debts_all" ON public.debts;
  CREATE POLICY "family_debts_all"
    ON public.debts FOR ALL TO authenticated
    USING (
      family_id IS NOT NULL
      AND family_id IN (
        SELECT fm.family_id FROM public.family_members fm WHERE fm.user_id = auth.uid()
      )
    )
    WITH CHECK (
      family_id IS NOT NULL
      AND family_id IN (
        SELECT fm.family_id FROM public.family_members fm WHERE fm.user_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "family_debt_payments_all" ON public.debt_payments;
  CREATE POLICY "family_debt_payments_all"
    ON public.debt_payments FOR ALL TO authenticated
    USING (
      family_id IS NOT NULL
      AND family_id IN (
        SELECT fm.family_id FROM public.family_members fm WHERE fm.user_id = auth.uid()
      )
    )
    WITH CHECK (
      family_id IS NOT NULL
      AND family_id IN (
        SELECT fm.family_id FROM public.family_members fm WHERE fm.user_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "family_notes_all" ON public.notes;
  CREATE POLICY "family_notes_all"
    ON public.notes FOR ALL TO authenticated
    USING (
      family_id IS NOT NULL
      AND family_id IN (
        SELECT fm.family_id FROM public.family_members fm WHERE fm.user_id = auth.uid()
      )
    )
    WITH CHECK (
      family_id IS NOT NULL
      AND family_id IN (
        SELECT fm.family_id FROM public.family_members fm WHERE fm.user_id = auth.uid()
      )
    );

  -- Subcategories: seeded (null user/family readable); custom scoped by family_id
  DROP POLICY IF EXISTS "subcategories_select_family" ON public.subcategories;
  CREATE POLICY "subcategories_select_family"
    ON public.subcategories FOR SELECT TO authenticated
    USING (
      (user_id IS NULL AND family_id IS NULL)
      OR (
        family_id IS NOT NULL
        AND family_id IN (
          SELECT fm.family_id FROM public.family_members fm WHERE fm.user_id = auth.uid()
        )
      )
    );

  DROP POLICY IF EXISTS "subcategories_insert_custom_family" ON public.subcategories;
  CREATE POLICY "subcategories_insert_custom_family"
    ON public.subcategories FOR INSERT TO authenticated
    WITH CHECK (
      user_id = auth.uid()
      AND family_id IS NOT NULL
      AND family_id IN (
        SELECT fm.family_id FROM public.family_members fm WHERE fm.user_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "subcategories_update_custom_family" ON public.subcategories;
  CREATE POLICY "subcategories_update_custom_family"
    ON public.subcategories FOR UPDATE TO authenticated
    USING (
      user_id IS NOT NULL
      AND family_id IS NOT NULL
      AND family_id IN (
        SELECT fm.family_id FROM public.family_members fm WHERE fm.user_id = auth.uid()
      )
    )
    WITH CHECK (
      user_id IS NOT NULL
      AND family_id IS NOT NULL
      AND family_id IN (
        SELECT fm.family_id FROM public.family_members fm WHERE fm.user_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "subcategories_delete_custom_family" ON public.subcategories;
  CREATE POLICY "subcategories_delete_custom_family"
    ON public.subcategories FOR DELETE TO authenticated
    USING (
      user_id IS NOT NULL
      AND family_id IS NOT NULL
      AND family_id IN (
        SELECT fm.family_id FROM public.family_members fm WHERE fm.user_id = auth.uid()
      )
    );

  -- -----------------------------------------------------------------------------
  -- Realtime (opcional pero recomendado para sync en vivo entre dispositivos)
  -- Supabase Dashboard → Database → Replication: activar publication para las tablas
  -- públicas financieras (accounts, incomes, expense_records, etc.).
  -- -----------------------------------------------------------------------------
