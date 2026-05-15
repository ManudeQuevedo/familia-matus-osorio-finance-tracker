import { cache } from "react";

import { getFamilyIdForUser } from "@/lib/supabase/family-core";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export { getFamilyIdForUser } from "@/lib/supabase/family-core";

/** Dedupes within a single RSC tree render. */
export const getCachedFamilyIdForUser = cache(async (userId: string) => {
  const supabase = await createSupabaseServerClient();
  return getFamilyIdForUser(supabase, userId);
});
