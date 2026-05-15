import type { SupabaseClient } from "@supabase/supabase-js";

import { clearUserPreferences } from "@/lib/storage/user-preferences-storage";

/** Signs out and removes this user's scoped localStorage preferences. */
export async function signOutAndClearPreferences(
  supabase: SupabaseClient,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    clearUserPreferences(user.id);
  }
  await supabase.auth.signOut();
}
