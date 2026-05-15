import { NextResponse } from "next/server";

import {
  financialAdvisorSystemPrompt,
  streamClaudeText,
} from "@/lib/ai/claude";
import { computeGoalMetrics } from "@/lib/finance/goal-calculations";
import {
  fetchHouseholdFinanceContext,
  formatContextForPrompt,
} from "@/lib/finance/household-context";
import { num } from "@/lib/finance/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { goal_id?: string; locale?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const goalId = body.goal_id;
  const locale = body.locale === "en" ? "en" : "es";
  if (!goalId) {
    return NextResponse.json({ error: "goal_id required" }, { status: 400 });
  }

  const { data: goal, error: goalErr } = await supabase
    .from("goals")
    .select(
      "id, title, description, target_amount, current_amount, target_date, status, monthly_required, icon",
    )
    .eq("id", goalId)
    .maybeSingle();

  if (goalErr || !goal) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

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

  const target = num(goal.target_amount);
  const current = num(goal.current_amount);
  const metrics = computeGoalMetrics(
    target,
    current,
    goal.target_date as string,
  );

  const otherGoals = ctx.goals.filter((g) => g.id !== goalId);
  const householdBlock = formatContextForPrompt(ctx, locale);

  const userMessage =
    locale === "es"
      ? `Analiza esta meta financiera familiar:

META A ANALIZAR:
- Título: ${goal.title}
- Descripción: ${goal.description ?? "—"}
- Progreso: $${current.toFixed(0)} de $${target.toFixed(0)} MXN (${metrics.progressPercent.toFixed(0)}%)
- Fecha objetivo: ${goal.target_date}
- Meses restantes: ${metrics.monthsLeft}
- Ahorro mensual requerido (calculado): $${metrics.monthlyRequired.toFixed(0)} MXN
- Ahorro quincenal equivalente: $${metrics.biweeklyRequired.toFixed(0)} MXN
- Estado: ${goal.status}

CONTEXTO FINANCIERO FAMILIAR:
${householdBlock}

${otherGoals.length ? `Otras metas activas:\n${otherGoals.map((g) => `- ${g.title}: $${g.current_amount.toFixed(0)}/$${g.target_amount.toFixed(0)}`).join("\n")}` : ""}

Responde con estas secciones en markdown:
1. **¿Es alcanzable?** — evalúa si la meta es realista con el balance y plazo actuales
2. **Cómo lograrla más rápido** — 3–5 acciones concretas
3. **Dónde recortar gastos** — categorías específicas con montos aproximados en MXN
4. **Plan de abonos sugerido** — calendario mensual o quincenal hasta la fecha meta`
      : `Analyze this family financial goal:

GOAL:
- Title: ${goal.title}
- Description: ${goal.description ?? "—"}
- Progress: $${current.toFixed(0)} of $${target.toFixed(0)} MXN (${metrics.progressPercent.toFixed(0)}%)
- Target date: ${goal.target_date}
- Months left: ${metrics.monthsLeft}
- Required monthly savings: $${metrics.monthlyRequired.toFixed(0)} MXN
- Biweekly equivalent: $${metrics.biweeklyRequired.toFixed(0)} MXN
- Status: ${goal.status}

HOUSEHOLD FINANCES:
${householdBlock}

${otherGoals.length ? `Other active goals:\n${otherGoals.map((g) => `- ${g.title}`).join("\n")}` : ""}

Respond in markdown with:
1. **Is it achievable?**
2. **How to reach it faster**
3. **Where to cut expenses**
4. **Suggested contribution plan**`;

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

        await supabase
          .from("goals")
          .update({
            ai_suggestions: {
              generated_at: new Date().toISOString(),
              locale,
              analysis: fullText,
              metrics,
            },
          })
          .eq("id", goalId);

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
