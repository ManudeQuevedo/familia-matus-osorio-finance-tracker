import { NextResponse } from "next/server";

import {
  deleteAllConversations,
  deleteConversation,
  findConversationIdsMatchingContent,
  getConversationMessages,
  getLastMessagePreview,
  listConversationsWithMessageCounts,
  updateConversationTitle,
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

  if (conversationId) {
    const messages = await getConversationMessages(
      supabase,
      user.id,
      conversationId,
      { tailLimit: null },
    );
    return NextResponse.json({ messages });
  }

  const conversations = await listConversationsWithMessageCounts(
    supabase,
    user.id,
  );

  const withPreviews = await Promise.all(
    conversations.map(async (c) => {
      const preview = await getLastMessagePreview(supabase, c.id);
      return {
        ...c,
        preview,
      };
    }),
  );

  const qRaw = searchParams.get("q")?.trim() ?? "";
  const qLower = qRaw.toLowerCase();

  const filtered =
    qRaw.length > 0
      ? await (async () => {
          const contentIds = await findConversationIdsMatchingContent(
            supabase,
            user.id,
            qRaw,
          );
          return withPreviews.filter(
            (c) =>
              contentIds.has(c.id) ||
              (c.title ?? "").toLowerCase().includes(qLower) ||
              (c.preview ?? "").toLowerCase().includes(qLower),
          );
        })()
      : withPreviews;

  return NextResponse.json({ conversations: filtered });
}

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: string; title?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const conversationId = body.id?.trim();
  if (!conversationId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  const ok = await updateConversationTitle(
    supabase,
    user.id,
    conversationId,
    title.length > 0 ? title : null,
  );

  if (!ok) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
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
  const deleteAll = searchParams.get("all") === "1";

  if (deleteAll) {
    const ok = await deleteAllConversations(supabase, user.id);
    if (!ok) {
      return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (!conversationId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const ok = await deleteConversation(supabase, user.id, conversationId);
  if (!ok) {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
