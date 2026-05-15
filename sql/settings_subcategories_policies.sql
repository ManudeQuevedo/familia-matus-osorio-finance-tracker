-- Custom subcategories per user + RLS for insert/update
-- Run in Supabase SQL Editor after family_finance_schema.sql

ALTER TABLE public.subcategories
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS subcategories_user_id_idx ON public.subcategories (user_id);

COMMENT ON COLUMN public.subcategories.user_id IS 'NULL = seeded/system subcategory; set = custom user subcategory';

DROP POLICY IF EXISTS "subcategories_insert_custom" ON public.subcategories;
CREATE POLICY "subcategories_insert_custom"
  ON public.subcategories FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "subcategories_update_custom" ON public.subcategories;
CREATE POLICY "subcategories_update_custom"
  ON public.subcategories FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "subcategories_delete_custom" ON public.subcategories;
CREATE POLICY "subcategories_delete_custom"
  ON public.subcategories FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
