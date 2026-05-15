import type { SupabaseClient } from "@supabase/supabase-js";

/** Family lookup without `next/headers` — safe to import from client-bundled modules. */
export async function getFamilyIdForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  // Prefer RPC (SECURITY DEFINER): reads membership using auth.uid() without depending on
  // family_members SELECT RLS. Deploy: sql/family_members_rls_select_fix.sql or migration.
  const { data: rpcId, error: rpcError } = await supabase.rpc(
    "family_id_for_current_user",
  );
  if (!rpcError && rpcId != null && rpcId !== "") {
    return rpcId as string;
  }

  // Fallback if RPC not deployed yet (PostgREST / SQL migration pending).
  const { data, error } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", userId)
    .order("family_id", { ascending: true })
    .limit(1);
  if (error) return null;
  const row = data?.[0];
  return (row?.family_id as string | undefined) ?? null;
}
