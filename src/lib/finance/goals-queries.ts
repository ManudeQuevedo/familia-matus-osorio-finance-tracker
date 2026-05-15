import type { SupabaseClient } from "@supabase/supabase-js";

import type { AppLocale } from "@/lib/finance/dashboard-queries";
import { computeGoalMetrics } from "@/lib/finance/goal-calculations";
import { num } from "@/lib/finance/format";

export type GoalStatus = "active" | "completed" | "paused";

export type GoalListItem = {
  id: string;
  title: string;
  description: string | null;
  icon: string;
  color: string;
  target_amount: number;
  current_amount: number;
  target_date: string;
  monthly_required: number;
  status: GoalStatus;
  shared_goal: boolean;
  ai_suggestions: Record<string, unknown>;
  monthsLeft: number;
  monthlyRequired: number;
  biweeklyRequired: number;
  progressPercent: number;
  isOwner: boolean;
};

export type GoalsSnapshot = {
  locale: AppLocale;
  goals: GoalListItem[];
  household: {
    monthlyIncome: number;
    monthlyExpenses: number;
    monthlyBalance: number;
  };
};

export async function fetchGoalsSnapshot(
  supabase: SupabaseClient,
  args: {
    userId: string;
    year: number;
    month: number;
    locale: AppLocale;
  },
): Promise<{ data: GoalsSnapshot | null; error: string | null }> {
  const { userId, year, month, locale } = args;

  try {
    const pad = (n: number) => String(n).padStart(2, "0");
    const monthStart = `${year}-${pad(month)}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const monthEnd = `${year}-${pad(month)}-${pad(lastDay)}`;

    const [goalsRes, incomesRes, variableRes, recordsRes] = await Promise.all([
      supabase
        .from("goals")
        .select(
          "id, user_id, title, description, icon, color, target_amount, current_amount, target_date, monthly_required, status, shared_goal, ai_suggestions",
        )
        .order("target_date", { ascending: true }),
      supabase
        .from("incomes")
        .select("amount_mxn")
        .eq("period_year", year)
        .eq("period_month", month),
      supabase
        .from("variable_expenses")
        .select("amount")
        .gte("date", monthStart)
        .lte("date", monthEnd),
      supabase
        .from("expense_records")
        .select("amount")
        .eq("period_year", year)
        .eq("period_month", month),
    ]);

    if (goalsRes.error) throw goalsRes.error;
    if (incomesRes.error) throw incomesRes.error;
    if (variableRes.error) throw variableRes.error;
    if (recordsRes.error) throw recordsRes.error;

    const monthlyIncome = (incomesRes.data ?? []).reduce(
      (s, r) => s + num(r.amount_mxn),
      0,
    );
    const monthlyExpenses =
      (variableRes.data ?? []).reduce((s, r) => s + num(r.amount), 0) +
      (recordsRes.data ?? []).reduce((s, r) => s + num(r.amount), 0);

    const goals: GoalListItem[] = (goalsRes.data ?? []).map((g) => {
      const target = num(g.target_amount);
      const current = num(g.current_amount);
      const metrics = computeGoalMetrics(
        target,
        current,
        g.target_date as string,
      );
      const status = g.status as GoalStatus;
      const completed =
        current >= target && target > 0 ? "completed" : status;

      return {
        id: g.id as string,
        title: g.title as string,
        description: (g.description as string | null) ?? null,
        icon: (g.icon as string) ?? "target",
        color: (g.color as string) ?? "#22c55e",
        target_amount: target,
        current_amount: current,
        target_date: g.target_date as string,
        monthly_required: num(g.monthly_required),
        status: completed as GoalStatus,
        shared_goal: Boolean(g.shared_goal),
        ai_suggestions: (g.ai_suggestions as Record<string, unknown>) ?? {},
        monthsLeft: metrics.monthsLeft,
        monthlyRequired: metrics.monthlyRequired,
        biweeklyRequired: metrics.biweeklyRequired,
        progressPercent: metrics.progressPercent,
        isOwner: (g.user_id as string) === userId,
      };
    });

    return {
      data: {
        locale,
        goals,
        household: {
          monthlyIncome,
          monthlyExpenses,
          monthlyBalance: monthlyIncome - monthlyExpenses,
        },
      },
      error: null,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { data: null, error: message };
  }
}
