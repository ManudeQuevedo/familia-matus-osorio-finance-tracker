import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_MESSAGES_PER_HOUR = 20;

export async function checkAiRateLimit(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from("ai_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", "user")
    .gte("created_at", oneHourAgo);

  if (error) {
    return { allowed: true, remaining: MAX_MESSAGES_PER_HOUR };
  }

  const used = count ?? 0;
  const remaining = Math.max(0, MAX_MESSAGES_PER_HOUR - used);
  return {
    allowed: used < MAX_MESSAGES_PER_HOUR,
    remaining,
  };
}
