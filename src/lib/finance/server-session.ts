import { cache } from "react";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Dedupes Supabase client + auth within a single RSC request. */
export const getFinanceServerSession = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return { supabase, user, error };
});
