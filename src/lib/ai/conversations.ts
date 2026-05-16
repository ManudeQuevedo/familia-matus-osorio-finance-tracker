import type { SupabaseClient } from "@supabase/supabase-js";

function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export type AiConversationRow = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
};

export type AiMessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

export async function listConversations(
  supabase: SupabaseClient,
  userId: string,
  limit = 50,
): Promise<AiConversationRow[]> {
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("id, title, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as AiConversationRow[];
}

type ConversationRowWithNestedCount = AiConversationRow & {
  ai_messages?: { count: number }[] | null;
};

function parseNestedMessageCount(row: ConversationRowWithNestedCount): number {
  const nested = row.ai_messages;
  if (
    Array.isArray(nested) &&
    nested.length > 0 &&
    typeof nested[0]?.count === "number"
  ) {
    return nested[0].count;
  }
  return 0;
}

/** Lists conversations with message counts (nested count query when supported). */
export async function listConversationsWithMessageCounts(
  supabase: SupabaseClient,
  userId: string,
  limit = 100,
): Promise<(AiConversationRow & { message_count: number })[]> {
  const { data, error } = await supabase
    .from("ai_conversations")
    .select(
      `
      id,
      title,
      created_at,
      updated_at,
      ai_messages(count)
    `,
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    const basic = await listConversations(supabase, userId, limit);
    const ids = basic.map((c) => c.id);
    if (ids.length === 0) return [];

    const { data: midRows } = await supabase
      .from("ai_messages")
      .select("conversation_id")
      .eq("user_id", userId)
      .in("conversation_id", ids);

    const countMap = new Map<string, number>();
    for (const r of midRows ?? []) {
      const cid = r.conversation_id as string;
      countMap.set(cid, (countMap.get(cid) ?? 0) + 1);
    }

    return basic.map((row) => ({
      ...row,
      message_count: countMap.get(row.id) ?? 0,
    }));
  }

  const rows = (data ?? []) as ConversationRowWithNestedCount[];
  return rows.map((row) => {
    const { ai_messages: _omit, ...rest } = row;
    return {
      ...rest,
      message_count: parseNestedMessageCount(row),
    };
  });
}

export async function findConversationIdsMatchingContent(
  supabase: SupabaseClient,
  userId: string,
  q: string,
): Promise<Set<string>> {
  const trimmed = q.trim();
  if (!trimmed) return new Set();

  const safe = escapeIlikePattern(trimmed);
  const { data, error } = await supabase
    .from("ai_messages")
    .select("conversation_id")
    .eq("user_id", userId)
    .ilike("content", `%${safe}%`);

  if (error) throw error;
  return new Set(
    (data ?? []).map((r) => r.conversation_id as string).filter(Boolean),
  );
}

export async function getConversationMessages(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  opts?: { tailLimit?: number | null },
): Promise<AiMessageRow[]> {
  const { data: conv } = await supabase
    .from("ai_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!conv) return [];

  const { data, error } = await supabase
    .from("ai_messages")
    .select("id, role, content, created_at, metadata")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as AiMessageRow[];
  const limit = opts?.tailLimit ?? 20;
  if (limit == null || limit <= 0 || rows.length <= limit) return rows;
  return rows.slice(-limit);
}

export async function getLastMessagePreview(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("ai_messages")
    .select("content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.content) return null;
  const text = data.content as string;
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

export async function deleteConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("ai_conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", userId);

  return !error;
}

export async function deleteAllConversations(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("ai_conversations")
    .delete()
    .eq("user_id", userId);

  return !error;
}

export async function updateConversationTitle(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  title: string | null,
): Promise<boolean> {
  const { error } = await supabase
    .from("ai_conversations")
    .update({ title })
    .eq("id", conversationId)
    .eq("user_id", userId);

  return !error;
}
