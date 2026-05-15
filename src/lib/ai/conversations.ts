import type { SupabaseClient } from "@supabase/supabase-js";

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

export async function getConversationMessages(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  limit = 20,
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
  if (rows.length <= limit) return rows;
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
