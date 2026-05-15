import Anthropic from "@anthropic-ai/sdk";

import {
  getFinancialSnapshot,
  persistFinancialSnapshot,
  type AiPageContext,
} from "@/lib/ai/financial-context";
import { checkAiRateLimit } from "@/lib/ai/rate-limit";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { getAnthropicClient } from "@/lib/ai/claude";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const MODEL = "claude-sonnet-4-20250514";
const MAX_HISTORY = 20;

type ChatBody = {
  message?: string;
  conversationId?: string | null;
  conversationHistory?: { role: "user" | "assistant"; content: string }[];
  pageContext?: AiPageContext;
};

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: ChatBody;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return new Response("Message required", { status: 400 });
  }

  const rate = await checkAiRateLimit(supabase, user.id);
  if (!rate.allowed) {
    return new Response(
      JSON.stringify({
        error: "rate_limit",
        message:
          "Has alcanzado el límite de 20 mensajes por hora. Intenta más tarde.",
      }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    );
  }

  const client = getAnthropicClient();
  if (!client) {
    return new Response(
      JSON.stringify({ error: "AI not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  let snapshot;
  try {
    snapshot = await getFinancialSnapshot(
      user.id,
      body.pageContext,
      supabase,
    );
    void persistFinancialSnapshot(user.id, snapshot, supabase);
  } catch {
    snapshot = {
      generatedAt: new Date().toISOString(),
      partial: true,
      profile: { name: null, language: "es" },
      currentPeriod: {
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
      },
      summary: {
        monthlyIncome: 0,
        monthlyExpenses: 0,
        monthlyBalance: 0,
        savingsRate: 0,
        totalDebt: 0,
        monthlyDebtPayments: 0,
        debtToIncomeRatio: 0,
      },
      income: { sources: [], lastTwelveMonths: [] },
      expenses: {
        recurring: [],
        recentVariable: [],
        monthlyRecords: [],
      },
      goals: [],
      debts: [],
      accounts: [],
      partialErrors: ["snapshot_failed"],
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_language")
    .eq("id", user.id)
    .maybeSingle();

  const language = (profile?.preferred_language as string) ?? "es";
  const systemPrompt = buildSystemPrompt(snapshot, language);

  const prior = (body.conversationHistory ?? []).slice(-MAX_HISTORY);
  const messages: Anthropic.MessageParam[] = [
    ...prior.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: "user", content: message },
  ];

  let activeConversationId = body.conversationId ?? null;

  if (!activeConversationId) {
    const title =
      message.slice(0, 60) + (message.length > 60 ? "…" : "");
    const { data: conv, error: convError } = await supabase
      .from("ai_conversations")
      .insert({ user_id: user.id, title })
      .select("id")
      .single();

    if (convError || !conv) {
      return new Response("Could not create conversation", { status: 500 });
    }
    activeConversationId = conv.id as string;
  } else {
    await supabase
      .from("ai_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", activeConversationId)
      .eq("user_id", user.id);
  }

  await supabase.from("ai_messages").insert({
    conversation_id: activeConversationId,
    user_id: user.id,
    role: "user",
    content: message,
  });

  const anthropic = client;
  const convId = activeConversationId;

  let stream: ReturnType<typeof anthropic.messages.stream>;
  try {
    stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    });
  } catch {
    return new Response(
      JSON.stringify({
        error: "ai_error",
        message:
          language === "es"
            ? "No pude conectarme al asesor. Intenta de nuevo en un momento."
            : "Could not reach the advisor. Please try again shortly.",
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  let fullResponse = "";

  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            const text = chunk.delta.text;
            fullResponse += text;
            controller.enqueue(encoder.encode(text));
          }
        }

        await supabase.from("ai_messages").insert({
          conversation_id: convId,
          user_id: user.id,
          role: "assistant",
          content: fullResponse,
          metadata: { snapshotDate: snapshot.generatedAt },
        });

        await supabase
          .from("ai_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", convId);

        controller.enqueue(
          encoder.encode(`\n__CONV_ID__${convId}__CONV_ID__`),
        );
        controller.close();
      } catch {
        const errMsg =
          language === "es"
            ? "No pude conectarme al asesor. Intenta de nuevo en un momento."
            : "Could not reach the advisor. Please try again shortly.";
        controller.enqueue(encoder.encode(errMsg));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Conversation-Id": convId ?? "",
    },
  });
}
