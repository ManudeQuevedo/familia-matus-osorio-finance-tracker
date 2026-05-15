import type { SupabaseClient } from "@supabase/supabase-js";

import type { AppLocale } from "@/lib/finance/dashboard-queries";
import { num } from "@/lib/finance/format";

export type HouseholdFinanceContext = {
  year: number;
  month: number;
  locale: AppLocale;
  monthlyIncome: number;
  monthlyRecurringExpenses: number;
  monthlyVariableExpenses: number;
  monthlyExpensesTotal: number;
  monthlyBalance: number;
  goals: {
    id: string;
    title: string;
    target_amount: number;
    current_amount: number;
    target_date: string;
    status: string;
    monthly_required: number;
  }[];
  debts: {
    id: string;
    name: string;
    current_balance: number;
    total_amount: number;
    monthly_payment: number;
    interest_rate: number | null;
    due_day: number;
  }[];
  topExpenseCategories: { name: string; amount: number }[];
};

export async function fetchHouseholdFinanceContext(
  supabase: SupabaseClient,
  args: { year: number; month: number; locale: AppLocale },
): Promise<HouseholdFinanceContext> {
  const { year, month, locale } = args;
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthStart = `${year}-${pad(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${pad(month)}-${pad(lastDay)}`;

  const [incomesRes, variableRes, recordsRes, goalsRes, debtsRes, categoriesRes] =
    await Promise.all([
      supabase
        .from("incomes")
        .select("amount_mxn")
        .eq("period_year", year)
        .eq("period_month", month),
      supabase
        .from("variable_expenses")
        .select("amount, category_id")
        .gte("date", monthStart)
        .lte("date", monthEnd),
      supabase
        .from("expense_records")
        .select("amount, subcategory_id")
        .eq("period_year", year)
        .eq("period_month", month),
      supabase
        .from("goals")
        .select(
          "id, title, target_amount, current_amount, target_date, status, monthly_required",
        )
        .in("status", ["active", "paused"])
        .order("target_date", { ascending: true }),
      supabase
        .from("debts")
        .select(
          "id, name, current_balance, total_amount, monthly_payment, interest_rate, due_day",
        )
        .eq("status", "active")
        .order("current_balance", { ascending: false }),
      supabase.from("categories").select("id, name_es, name_en"),
    ]);

  if (incomesRes.error) throw incomesRes.error;
  if (variableRes.error) throw variableRes.error;
  if (recordsRes.error) throw recordsRes.error;
  if (goalsRes.error) throw goalsRes.error;
  if (debtsRes.error) throw debtsRes.error;
  if (categoriesRes.error) throw categoriesRes.error;

  const monthlyIncome = (incomesRes.data ?? []).reduce(
    (s, r) => s + num(r.amount_mxn),
    0,
  );
  const monthlyVariableExpenses = (variableRes.data ?? []).reduce(
    (s, r) => s + num(r.amount),
    0,
  );
  const monthlyRecurringExpenses = (recordsRes.data ?? []).reduce(
    (s, r) => s + num(r.amount),
    0,
  );
  const monthlyExpensesTotal =
    monthlyVariableExpenses + monthlyRecurringExpenses;

  const catById = new Map(
    (categoriesRes.data ?? []).map((c) => [
      c.id as string,
      locale === "es" ? (c.name_es as string) : (c.name_en as string),
    ]),
  );

  const subRes = await supabase
    .from("subcategories")
    .select("id, category_id");
  if (subRes.error) throw subRes.error;
  const subToCat = new Map(
    (subRes.data ?? []).map((s) => [s.id as string, s.category_id as string]),
  );

  const categoryTotals = new Map<string, number>();
  for (const row of variableRes.data ?? []) {
    const catId = row.category_id as string;
    const name = catById.get(catId) ?? "—";
    categoryTotals.set(name, (categoryTotals.get(name) ?? 0) + num(row.amount));
  }
  for (const row of recordsRes.data ?? []) {
    const subId = row.subcategory_id as string;
    const catId = subToCat.get(subId);
    if (!catId) continue;
    const name = catById.get(catId) ?? "—";
    categoryTotals.set(name, (categoryTotals.get(name) ?? 0) + num(row.amount));
  }

  const topExpenseCategories = [...categoryTotals.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  return {
    year,
    month,
    locale,
    monthlyIncome,
    monthlyRecurringExpenses,
    monthlyVariableExpenses,
    monthlyExpensesTotal,
    monthlyBalance: monthlyIncome - monthlyExpensesTotal,
    goals: (goalsRes.data ?? []).map((g) => ({
      id: g.id as string,
      title: g.title as string,
      target_amount: num(g.target_amount),
      current_amount: num(g.current_amount),
      target_date: g.target_date as string,
      status: g.status as string,
      monthly_required: num(g.monthly_required),
    })),
    debts: (debtsRes.data ?? []).map((d) => ({
      id: d.id as string,
      name: d.name as string,
      current_balance: num(d.current_balance),
      total_amount: num(d.total_amount),
      monthly_payment: num(d.monthly_payment),
      interest_rate:
        d.interest_rate != null ? num(d.interest_rate) : null,
      due_day: Number(d.due_day),
    })),
    topExpenseCategories,
  };
}

export function formatContextForPrompt(
  ctx: HouseholdFinanceContext,
  locale: AppLocale,
): string {
  const lines = [
    `Periodo: ${ctx.month}/${ctx.year}`,
    `Ingresos mensuales familiares: $${ctx.monthlyIncome.toFixed(2)} MXN`,
    `Gastos fijos (recurrentes): $${ctx.monthlyRecurringExpenses.toFixed(2)} MXN`,
    `Gastos variables: $${ctx.monthlyVariableExpenses.toFixed(2)} MXN`,
    `Gastos totales: $${ctx.monthlyExpensesTotal.toFixed(2)} MXN`,
    `Balance mensual disponible: $${ctx.monthlyBalance.toFixed(2)} MXN`,
  ];

  if (ctx.topExpenseCategories.length) {
    lines.push(
      "Principales categorías de gasto:",
      ...ctx.topExpenseCategories.map(
        (c) => `- ${c.name}: $${c.amount.toFixed(2)} MXN`,
      ),
    );
  }

  if (ctx.goals.length) {
    lines.push(
      locale === "es" ? "Metas activas/pausadas:" : "Active/paused goals:",
    );
    for (const g of ctx.goals) {
      lines.push(
        `- ${g.title}: $${g.current_amount.toFixed(0)} / $${g.target_amount.toFixed(0)} MXN, meta ${g.target_date}, ahorro sugerido $${g.monthly_required.toFixed(0)}/mes (${g.status})`,
      );
    }
  }

  if (ctx.debts.length) {
    lines.push(locale === "es" ? "Deudas activas:" : "Active debts:");
    for (const d of ctx.debts) {
      const rate =
        d.interest_rate != null ? `${d.interest_rate}% anual` : "sin tasa";
      lines.push(
        `- ${d.name}: saldo $${d.current_balance.toFixed(0)} MXN, pago $${d.monthly_payment.toFixed(0)}/mes, día ${d.due_day}, ${rate}`,
      );
    }
  }

  return lines.join("\n");
}
