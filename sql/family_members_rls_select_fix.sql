-- Fix infinite RLS recursion on family_members: never subquery family_members inside
-- its own SELECT policy — use SECURITY DEFINER instead.
-- Run once in Supabase SQL Editor if SELECT on family_members errors with recursion.

CREATE OR REPLACE FUNCTION public.family_ids_for_current_user()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT fm.family_id
  FROM public.family_members fm
  WHERE fm.user_id = auth.uid();
$fn$;

REVOKE ALL ON FUNCTION public.family_ids_for_current_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.family_ids_for_current_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.family_ids_for_current_user() TO service_role;

DROP POLICY IF EXISTS "family_members_select_same_family" ON public.family_members;
CREATE POLICY "family_members_select_same_family"
  ON public.family_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR family_id IN (
      SELECT public.family_ids_for_current_user()
    )
  );

-- Optional but recommended: RPC used by the app first (works even if RLS on family_members is wrong).
CREATE OR REPLACE FUNCTION public.family_id_for_current_user()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT fm.family_id
  FROM public.family_members fm
  WHERE fm.user_id = auth.uid()
  ORDER BY fm.family_id
  LIMIT 1;
$fn$;

REVOKE ALL ON FUNCTION public.family_id_for_current_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.family_id_for_current_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.family_id_for_current_user() TO service_role;
