import type { SupabaseClient } from "@supabase/supabase-js";

import { householdCreatorInitial } from "@/lib/finance/household";
import { getFamilyIdForUser } from "@/lib/supabase/family-core";
import { errorMessageFromUnknown } from "@/lib/supabase/error-message";

export type AppLocale = "en" | "es";

export type PaycheckRecordRow = {
  id: string;
  name: string;
  amount: number;
  due_date: string;
  status: "paid" | "pending" | "overdue";
  paid_date: string | null;
  /** DB: 1 = days 15–30, 2 = days 1–15 */
  paycheck_period: 1 | 2;
  subcategoryName: string;
  categoryName: string;
  categoryColor: string;
  accountName: string;
  creatorInitial: string;
  recurringExpenseId: string | null;
};

export type CategorySlice = {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  amount: number;
  percent: number;
};

export type GoalRow = {
  id: string;
  title: string;
  current_amount: number;
  target_amount: number;
  target_date: string;
  color: string;
};

export type DebtRow = {
  id: string;
  name: string;
  current_balance: number;
  due_day: number;
  monthly_payment: number;
};

export type CategoryOption = {
  id: string;
  name_es: string;
  name_en: string;
  color: string;
  icon: string;
  type: string;
};

export type SubcategoryOption = {
  id: string;
  category_id: string;
  name: string;
};

export type DashboardSnapshot = {
  year: number;
  month: number;
  locale: AppLocale;
  profile: {
    full_name: string | null;
    avatar_url: string | null;
  };
  monthlyIncome: number;
  monthlyVariableExpense: number;
  monthlyRecurringExpense: number;
  paycheckRecords: PaycheckRecordRow[];
  categorySlices: CategorySlice[];
  goals: GoalRow[];
  debts: DebtRow[];
  categories: CategoryOption[];
  subcategories: SubcategoryOption[];
};

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number.parseFloat(v) || 0;
  return 0;
}

/** UI quincena 1 (1–15) → DB paycheck_period 2. UI quincena 2 (15–30) → DB period 1. */
export function uiQuincenaToDbPeriod(ui: 1 | 2): 1 | 2 {
  return ui === 1 ? 2 : 1;
}

export async function fetchDashboardSnapshot(
  supabase: SupabaseClient,
  args: {
    userId: string;
    year: number;
    month: number;
    locale: AppLocale;
  },
): Promise<{ data: DashboardSnapshot | null; error: string | null }> {
  const { userId, year, month, locale } = args;
  const familyId = await getFamilyIdForUser(supabase, userId);
  if (!familyId) {
    return { data: null, error: "family_not_configured" };
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthStart = `${year}-${pad(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${pad(month)}-${pad(lastDay)}`;

  try {
    const [
      profileRes,
      incomesRes,
      variableRes,
      recordsRes,
      goalsRes,
      debtsRes,
      categoriesRes,
      subcategoriesRes,
      accountsRes,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("incomes")
        .select("amount_mxn")
        .eq("family_id", familyId)
        .eq("period_year", year)
        .eq("period_month", month),
      supabase
        .from("variable_expenses")
        .select("amount, category_id")
        .eq("family_id", familyId)
        .gte("date", monthStart)
        .lte("date", monthEnd),
      supabase
        .from("expense_records")
        .select(
          "id, name, amount, due_date, status, paid_date, paycheck_period, subcategory_id, account_id, user_id, recurring_expense_id",
        )
        .eq("family_id", familyId)
        .eq("period_year", year)
        .eq("period_month", month)
        .order("due_date", { ascending: true }),
      supabase
        .from("goals")
        .select(
          "id, title, current_amount, target_amount, target_date, color, status",
        )
        .eq("family_id", familyId)
        .eq("status", "active")
        .order("target_date", { ascending: true })
        .limit(3),
      supabase
        .from("debts")
        .select("id, name, current_balance, due_day, monthly_payment, status")
        .eq("family_id", familyId)
        .eq("status", "active"),
      supabase
        .from("categories")
        .select("id, name_es, name_en, color, icon, type")
        .in("type", ["expense", "both"])
        .order("name_en"),
      supabase
        .from("subcategories")
        .select("id, category_id, name, is_active")
        .eq("is_active", true)
        .order("name"),
      supabase.from("accounts").select("id, name").eq("family_id", familyId),
    ]);

    if (profileRes.error) throw profileRes.error;
    if (incomesRes.error) throw incomesRes.error;
    if (variableRes.error) throw variableRes.error;
    if (recordsRes.error) throw recordsRes.error;
    if (goalsRes.error) throw goalsRes.error;
    if (debtsRes.error) throw debtsRes.error;
    if (categoriesRes.error) throw categoriesRes.error;
    if (subcategoriesRes.error) throw subcategoriesRes.error;
    if (accountsRes.error) throw accountsRes.error;

    const profile = profileRes.data ?? {
      full_name: null,
      avatar_url: null,
    };

    const monthlyIncome = (incomesRes.data ?? []).reduce(
      (s, r) => s + num(r.amount_mxn),
      0,
    );

    const categories = categoriesRes.data ?? [];
    const categoryById = new Map(categories.map((c) => [c.id, c]));

    const monthlyVariableExpense = (variableRes.data ?? []).reduce(
      (s, r) => s + num(r.amount),
      0,
    );

    const variableByCategory = new Map<string, number>();
    for (const row of variableRes.data ?? []) {
      const id = row.category_id as string;
      variableByCategory.set(id, (variableByCategory.get(id) ?? 0) + num(row.amount));
    }

    const records = recordsRes.data ?? [];

    const { data: dashProfiles } = await supabase
      .from("profiles")
      .select("id, email");
    const emailByUserId = new Map(
      (dashProfiles ?? []).map((p) => [
        p.id as string,
        (p.email as string) ?? "",
      ]),
    );

    const subcategories = (subcategoriesRes.data ?? []).filter(Boolean);
    const subById = new Map(subcategories.map((s) => [s.id, s]));

    const accById = new Map((accountsRes.data ?? []).map((a) => [a.id, a.name]));

    const recurringByCategory = new Map<string, number>();
    const paycheckRecords: PaycheckRecordRow[] = [];

    for (const r of records) {
      const amount = num(r.amount);
      const sub = subById.get(r.subcategory_id as string);
      const cat = sub ? categoryById.get(sub.category_id) : undefined;
      if (sub && cat) {
        recurringByCategory.set(
          cat.id,
          (recurringByCategory.get(cat.id) ?? 0) + amount,
        );
      }
      const categoryName =
        cat?.[locale === "es" ? "name_es" : "name_en"] ?? "—";
      paycheckRecords.push({
        id: r.id as string,
        name: r.name as string,
        amount,
        due_date: r.due_date as string,
        status: r.status as PaycheckRecordRow["status"],
        paid_date: (r.paid_date as string | null) ?? null,
        paycheck_period: r.paycheck_period as 1 | 2,
        subcategoryName: sub?.name ?? "—",
        categoryName,
        categoryColor: cat?.color ?? "#64748b",
        accountName: (accById.get(r.account_id as string) as string) ?? "—",
        creatorInitial: householdCreatorInitial(
          r.user_id as string,
          emailByUserId,
        ),
        recurringExpenseId: (r.recurring_expense_id as string | null) ?? null,
      });
    }

    const monthlyRecurringExpense = records.reduce(
      (s, r) => s + num(r.amount),
      0,
    );

    const categorySlicesMap = new Map<string, CategorySlice>();
    for (const c of categories) {
      const v = variableByCategory.get(c.id) ?? 0;
      const rec = recurringByCategory.get(c.id) ?? 0;
      const total = v + rec;
      if (total > 0) {
        categorySlicesMap.set(c.id, {
          categoryId: c.id,
          name: locale === "es" ? c.name_es : c.name_en,
          color: c.color,
          icon: c.icon,
          amount: total,
          percent: 0,
        });
      }
    }
    const totalSpend = [...categorySlicesMap.values()].reduce(
      (s, x) => s + x.amount,
      0,
    );
    const categorySlices = [...categorySlicesMap.values()].map((slice) => ({
      ...slice,
      percent: totalSpend > 0 ? (slice.amount / totalSpend) * 100 : 0,
    }));
    categorySlices.sort((a, b) => b.amount - a.amount);

    const goals: GoalRow[] = (goalsRes.data ?? []).map((g) => ({
      id: g.id as string,
      title: g.title as string,
      current_amount: num(g.current_amount),
      target_amount: num(g.target_amount),
      target_date: g.target_date as string,
      color: (g.color as string) ?? "#22c55e",
    }));

    const debts: DebtRow[] = (debtsRes.data ?? []).map((d) => ({
      id: d.id as string,
      name: d.name as string,
      current_balance: num(d.current_balance),
      due_day: Number(d.due_day),
      monthly_payment: num(d.monthly_payment),
    }));

    return {
      data: {
        year,
        month,
        locale,
        profile: {
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
        },
        monthlyIncome,
        monthlyVariableExpense,
        monthlyRecurringExpense,
        paycheckRecords,
        categorySlices,
        goals,
        debts,
        categories: categories as CategoryOption[],
        subcategories: subcategories.map((s) => ({
          id: s.id as string,
          category_id: s.category_id as string,
          name: s.name as string,
        })),
      },
      error: null,
    };
  } catch (e) {
    return { data: null, error: errorMessageFromUnknown(e) };
  }
}
