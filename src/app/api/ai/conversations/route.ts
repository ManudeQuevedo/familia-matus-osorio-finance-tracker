import { NextResponse } from "next/server";

import {
  deleteConversation,
  getConversationMessages,
  getLastMessagePreview,
  listConversations,
} from "@/lib/ai/conversations";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("id");
  const q = searchParams.get("q")?.trim().toLowerCase();

  if (conversationId) {
    const messages = await getConversationMessages(
      supabase,
      user.id,
      conversationId,
    );
    return NextResponse.json({ messages });
  }

  const conversations = await listConversations(supabase, user.id);

  const withPreviews = await Promise.all(
    conversations.map(async (c) => {
      const preview = await getLastMessagePreview(supabase, c.id);
      return {
        ...c,
        preview,
      };
    }),
  );

  const filtered = q
    ? withPreviews.filter(
        (c) =>
          (c.title ?? "").toLowerCase().includes(q) ||
          (c.preview ?? "").toLowerCase().includes(q),
      )
    : withPreviews;

  return NextResponse.json({ conversations: filtered });
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("id");

  if (!conversationId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const ok = await deleteConversation(supabase, user.id, conversationId);
  if (!ok) {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
