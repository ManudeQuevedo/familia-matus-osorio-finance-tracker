import { NextResponse } from "next/server";

import {
  financialAdvisorSystemPrompt,
  streamClaudeText,
} from "@/lib/ai/claude";
import {
  fetchHouseholdFinanceContext,
  formatContextForPrompt,
} from "@/lib/finance/household-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFamilyIdForUser } from "@/lib/supabase/family";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { locale?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const locale = body.locale === "en" ? "en" : "es";
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  let ctx;
  try {
    ctx = await fetchHouseholdFinanceContext(supabase, { year, month, locale });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Context error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!ctx.debts.length) {
    return NextResponse.json({ error: "No active debts" }, { status: 400 });
  }

  const debtLines = ctx.debts
    .map(
      (d) =>
        `- ${d.name}: saldo $${d.current_balance.toFixed(0)} MXN (original $${d.total_amount.toFixed(0)}), pago mensual $${d.monthly_payment.toFixed(0)}, día ${d.due_day}, tasa ${d.interest_rate ?? "N/D"}%`,
    )
    .join("\n");

  const householdBlock = formatContextForPrompt(ctx, locale);

  const userMessage =
    locale === "es"
      ? `Crea un plan integral de pago de deudas para esta familia.

DEUDAS:
${debtLines}

CONTEXTO FINANCIERO:
${householdBlock}

METAS ACTIVAS: ${ctx.goals.length ? ctx.goals.map((g) => g.title).join(", ") : "ninguna"}

Responde en markdown con:
1. **Estrategia recomendada** — Avalancha (mayor tasa primero) o Bola de nieve (menor saldo primero), con justificación breve
2. **Orden de ataque** — lista numerada de deudas
3. **Fechas estimadas de payoff** — por cada deuda con la estrategia elegida
4. **Dinero extra mensual** — cuánto liberar y de qué gastos recortar (categorías y montos MXN)
5. **Proyección** — ahorro estimado en intereses y meses vs pagar solo mínimos

Al final incluye un bloque JSON (solo JSON, sin markdown) con esta forma:
\`\`\`json
{
  "strategy": "avalanche" | "snowball",
  "order": ["nombre deuda 1", "nombre deuda 2"],
  "timeline": [{"debt": "nombre", "payoffMonth": "YYYY-MM"}],
  "comparison": {
    "withoutPlanMonths": 0,
    "withPlanMonths": 0,
    "interestSavedMxn": 0
  },
  "monthlyExtraMxn": 0
}
\`\`\``
      : `Create a comprehensive debt payoff plan.

DEBTS:
${debtLines}

HOUSEHOLD FINANCES:
${householdBlock}

ACTIVE GOALS: ${ctx.goals.length ? ctx.goals.map((g) => g.title).join(", ") : "none"}

Respond in markdown with:
1. **Recommended strategy** — Avalanche vs Snowball with brief rationale
2. **Payoff order**
3. **Estimated payoff dates** per debt
4. **Extra monthly cash** — how much and which expense categories to cut
5. **Projection** — interest and time saved vs minimum payments

End with a JSON block:
\`\`\`json
{
  "strategy": "avalanche" | "snowball",
  "order": ["debt name 1"],
  "timeline": [{"debt": "name", "payoffMonth": "YYYY-MM"}],
  "comparison": {"withoutPlanMonths": 0, "withPlanMonths": 0, "interestSavedMxn": 0},
  "monthlyExtraMxn": 0
}
\`\`\``;

  const encoder = new TextEncoder();
  let fullText = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        fullText = await streamClaudeText({
          system: financialAdvisorSystemPrompt(locale),
          userMessage,
          onText: (chunk) => {
            controller.enqueue(encoder.encode(chunk));
          },
        });

        let structured: Record<string, unknown> = {};
        const jsonMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch?.[1]) {
          try {
            structured = JSON.parse(jsonMatch[1]) as Record<string, unknown>;
          } catch {
            structured = {};
          }
        }

        const analysisMarkdown = fullText.replace(
          /```json[\s\S]*?```/,
          "",
        ).trim();

        const planPayload = {
          generated_at: new Date().toISOString(),
          locale,
          analysis: analysisMarkdown,
          active: false,
          ...structured,
        };

        const familyId = await getFamilyIdForUser(supabase, user.id);

        const { data: userDebts } =
          familyId != null
            ? await supabase
                .from("debts")
                .select("id")
                .eq("family_id", familyId)
                .eq("status", "active")
            : await supabase
                .from("debts")
                .select("id")
                .eq("user_id", user.id)
                .eq("status", "active");

        for (const d of userDebts ?? []) {
          await supabase
            .from("debts")
            .update({ ai_plan: planPayload })
            .eq("id", d.id as string);
        }

        controller.close();
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "AI request failed";
        controller.enqueue(encoder.encode(`\n\n[Error: ${message}]`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
