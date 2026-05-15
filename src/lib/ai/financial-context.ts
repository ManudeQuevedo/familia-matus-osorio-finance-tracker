import type { SupabaseClient } from "@supabase/supabase-js";

import { HOUSEHOLD_EMAILS } from "@/lib/finance/household";
import { num } from "@/lib/finance/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFamilyIdForUser } from "@/lib/supabase/family";

export type AiPageContext = {
  currentPage?: string;
  currentMonth?: string;
  viewingPeriod?: string;
  focusedGoal?: string;
  [key: string]: string | undefined;
};

export type FinancialSnapshot = {
  generatedAt: string;
  pageContext?: AiPageContext;
  profile: {
    name: string | null;
    language: string | null;
  };
  currentPeriod: { month: number; year: number };
  summary: {
    monthlyIncome: number;
    monthlyExpenses: number;
    monthlyBalance: number;
    savingsRate: string | number;
    totalDebt: number;
    monthlyDebtPayments: number;
    debtToIncomeRatio: string | number;
  };
  income: {
    sources: unknown[];
    lastTwelveMonths: unknown[];
  };
  expenses: {
    recurring: unknown[];
    recentVariable: unknown[];
    monthlyRecords: unknown[];
  };
  goals: unknown[];
  debts: unknown[];
  accounts: unknown[];
  partial?: boolean;
  partialErrors?: string[];
};

async function getHouseholdProfileIds(
  supabase: SupabaseClient,
): Promise<string[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .in("email", [...HOUSEHOLD_EMAILS]);
  return (data ?? []).map((p) => p.id as string);
}

export async function getFinancialSnapshot(
  userId: string,
  pageContext?: AiPageContext,
  supabaseClient?: SupabaseClient,
): Promise<FinancialSnapshot> {
  const supabase = supabaseClient ?? (await createSupabaseServerClient());
  const partialErrors: string[] = [];

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthStart = `${currentYear}-${pad(currentMonth)}-01`;
  const lastDay = new Date(currentYear, currentMonth, 0).getDate();
  const monthEnd = `${currentYear}-${pad(currentMonth)}-${pad(lastDay)}`;
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const incomeSinceYear = currentYear - 1;

  let householdIds: string[] = [];
  try {
    householdIds = await getHouseholdProfileIds(supabase);
  } catch {
    householdIds = [userId];
  }
  if (!householdIds.length) householdIds = [userId];

  const familyId =
    (await getFamilyIdForUser(supabase, userId).catch(() => null)) ?? null;

  const recurringQuery = supabase
    .from("recurring_expenses")
    .select("*, subcategories(name, categories(name_es, name_en))")
    .eq("is_active", true);
  const accountsQuery = supabase.from("accounts").select("*").eq("is_active", true);

  const safe = async <T>(
    label: string,
    query: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  ): Promise<T | null> => {
    try {
      const { data, error } = await query;
      if (error) {
        partialErrors.push(`${label}: ${error.message}`);
        return null;
      }
      return data;
    } catch (e) {
      partialErrors.push(
        `${label}: ${e instanceof Error ? e.message : "unknown"}`,
      );
      return null;
    }
  };

  const results = await Promise.all([
    safe(
      "profile",
      supabase
        .from("profiles")
        .select("full_name, preferred_language, email")
        .eq("id", userId)
        .single(),
    ),
    safe(
      "incomes",
      supabase
        .from("incomes")
        .select("*")
        .gte("period_year", incomeSinceYear)
        .order("received_date", { ascending: false }),
    ),
    safe(
      "recurring_expenses",
      familyId
        ? recurringQuery.eq("family_id", familyId)
        : recurringQuery.in("user_id", householdIds),
    ),
    safe(
      "variable_expenses",
      supabase
        .from("variable_expenses")
        .select("*, categories(name_es, name_en)")
        .gte("date", ninetyDaysAgo)
        .order("date", { ascending: false }),
    ),
    safe(
      "expense_records",
      supabase
        .from("expense_records")
        .select("*")
        .eq("period_year", currentYear)
        .eq("period_month", currentMonth)
        .order("due_date", { ascending: true }),
    ),
    safe(
      "goals",
      supabase
        .from("goals")
        .select("*, goal_contributions(*)")
        .in("status", ["active", "paused", "completed"])
        .order("target_date", { ascending: true }),
    ),
    safe(
      "debts",
      supabase
        .from("debts")
        .select("*")
        .eq("status", "active")
        .order("current_balance", { ascending: false }),
    ),
    safe(
      "debt_payments",
      supabase
        .from("debt_payments")
        .select("*")
        .order("payment_date", { ascending: false })
        .limit(50),
    ),
    safe(
      "accounts",
      familyId
        ? accountsQuery.eq("family_id", familyId)
        : accountsQuery.in("user_id", householdIds),
    ),
  ]);

  const [
    profile,
    incomes,
    recurringExpenses,
    variableExpenses,
    expenseRecords,
    goals,
    debts,
    debtPayments,
    accounts,
  ] = results as [
    { full_name?: string | null; preferred_language?: string | null } | null,
    Record<string, unknown>[] | null,
    Record<string, unknown>[] | null,
    Record<string, unknown>[] | null,
    Record<string, unknown>[] | null,
    Record<string, unknown>[] | null,
    Record<string, unknown>[] | null,
    Record<string, unknown>[] | null,
    Record<string, unknown>[] | null,
  ];

  const incomeRows = incomes ?? [];
  const monthlyIncome = incomeRows
    .filter(
      (i) =>
        Number(i.period_month) === currentMonth &&
        Number(i.period_year) === currentYear,
    )
    .reduce((sum, i) => sum + num(i.amount_mxn), 0);

  const monthlyRecurring = (expenseRecords ?? []).reduce(
    (sum, e) => sum + num(e.amount),
    0,
  );

  const monthlyVariable = (variableExpenses ?? [])
    .filter((e) => {
      const d = new Date(e.date as string);
      return (
        d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear
      );
    })
    .reduce((sum, e) => sum + num(e.amount), 0);

  const debtRows = debts ?? [];
  const totalDebt = debtRows.reduce(
    (sum, d) => sum + num(d.current_balance),
    0,
  );
  const monthlyDebtPayments = debtRows.reduce(
    (sum, d) => sum + num(d.monthly_payment),
    0,
  );

  const monthlyExpenses = monthlyRecurring + monthlyVariable;
  const monthlyBalance = monthlyIncome - monthlyExpenses;

  const snapshot: FinancialSnapshot = {
    generatedAt: new Date().toISOString(),
    ...(pageContext && Object.keys(pageContext).length > 0
      ? { pageContext }
      : {}),
    profile: {
      name: profile?.full_name ?? null,
      language: profile?.preferred_language ?? "es",
    },
    currentPeriod: { month: currentMonth, year: currentYear },
    summary: {
      monthlyIncome,
      monthlyExpenses,
      monthlyBalance,
      savingsRate:
        monthlyIncome > 0
          ? (
              ((monthlyIncome - monthlyExpenses) / monthlyIncome) *
              100
            ).toFixed(1)
          : 0,
      totalDebt,
      monthlyDebtPayments,
      debtToIncomeRatio:
        monthlyIncome > 0
          ? ((monthlyDebtPayments / monthlyIncome) * 100).toFixed(1)
          : 0,
    },
    income: {
      sources: incomeRows,
      lastTwelveMonths: incomeRows,
    },
    expenses: {
      recurring: recurringExpenses ?? [],
      recentVariable: variableExpenses ?? [],
      monthlyRecords: expenseRecords ?? [],
    },
    goals: (goals ?? []).map((g) => {
      const target = num(g.target_amount);
      const current = num(g.current_amount);
      const targetDate = g.target_date as string;
      return {
        ...g,
        progressPercent:
          target > 0 ? ((current / target) * 100).toFixed(1) : 0,
        monthsRemaining: Math.ceil(
          (new Date(targetDate).getTime() - Date.now()) /
            (30 * 24 * 60 * 60 * 1000),
        ),
      };
    }),
    debts: debtRows.map((d) => ({
      ...d,
      recentPayments: (debtPayments ?? []).filter(
        (p) => p.debt_id === d.id,
      ),
    })),
    accounts: accounts ?? [],
  };

  if (partialErrors.length > 0) {
    snapshot.partial = true;
    snapshot.partialErrors = partialErrors;
  }

  void monthStart;
  void monthEnd;

  return snapshot;
}

export async function persistFinancialSnapshot(
  userId: string,
  snapshot: FinancialSnapshot,
  supabaseClient?: SupabaseClient,
): Promise<void> {
  const supabase = supabaseClient ?? (await createSupabaseServerClient());
  await supabase.from("ai_financial_snapshots").insert({
    user_id: userId,
    snapshot: snapshot as unknown as Record<string, unknown>,
  });
}
