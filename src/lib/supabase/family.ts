import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";

import { createSupabaseServerClient } from "@/lib/supabase/server";

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

/** Dedupes within a single RSC tree render. */
export const getCachedFamilyIdForUser = cache(async (userId: string) => {
  const supabase = await createSupabaseServerClient();
  return getFamilyIdForUser(supabase, userId);
});
