import type { SupabaseClient } from "@supabase/supabase-js";

/** Family lookup without `next/headers` — safe to import from client-bundled modules. */
export async function getFamilyIdForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return (data?.family_id as string | undefined) ?? null;
}
