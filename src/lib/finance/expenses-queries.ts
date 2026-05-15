import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AppLocale,
  CategoryOption,
  PaycheckRecordRow,
  SubcategoryOption,
} from "@/lib/finance/dashboard-queries";
import { num } from "@/lib/finance/format";
import { householdCreatorInitial, personFromEmail } from "@/lib/finance/household";
import { getFamilyIdForUser } from "@/lib/supabase/family-core";
import { errorMessageFromUnknown } from "@/lib/supabase/error-message";

export type AccountOption = {
  id: string;
  name: string;
  color: string;
};

export type RecurringTemplateRow = {
  id: string;
  name: string;
  amount: number;
  paycheck_period: 1 | 2;
  due_day: number | null;
  is_active: boolean;
  notes: string | null;
  subcategoryName: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  accountName: string;
  accountId: string;
  creatorInitial: string;
};

export type VariableExpenseRow = {
  id: string;
  description: string;
  amount: number;
  date: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  subcategoryName: string | null;
  creatorInitial: string;
};

export type ExpenseHistoryRow = {
  id: string;
  amount: number;
  status: string;
  paid_date: string | null;
  period_year: number;
  period_month: number;
};

export type ExpensesSnapshot = {
  year: number;
  month: number;
  locale: AppLocale;
  categories: CategoryOption[];
  subcategories: SubcategoryOption[];
  accounts: AccountOption[];
  expenseRecords: PaycheckRecordRow[];
  recurringTemplates: RecurringTemplateRow[];
  variableExpenses: VariableExpenseRow[];
};

export async function fetchExpensesSnapshot(
  supabase: SupabaseClient,
  args: {
    userId: string;
    year: number;
    month: number;
    locale: AppLocale;
  },
): Promise<{ data: ExpensesSnapshot | null; error: string | null }> {
  const { userId, year, month, locale } = args;
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthStart = `${year}-${pad(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${pad(month)}-${pad(lastDay)}`;

  try {
    const familyId = await getFamilyIdForUser(supabase, userId);
    if (!familyId) {
      return { data: null, error: "family_not_configured" };
    }

    const { data: famProfiles } = await supabase
      .from("profiles")
      .select("id, email");
    const emailByUserId = new Map(
      (famProfiles ?? []).map((p) => [p.id as string, (p.email as string) ?? ""]),
    );
    const [
      categoriesRes,
      subcategoriesRes,
      accountsRes,
      recordsRes,
      recurringRes,
      variableRes,
    ] = await Promise.all([
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
      supabase
        .from("accounts")
        .select("id, name, color, is_active")
        .eq("family_id", familyId)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("expense_records")
        .select(
          "id, name, amount, due_date, status, paid_date, paycheck_period, subcategory_id, account_id, recurring_expense_id, user_id",
        )
        .eq("family_id", familyId)
        .eq("period_year", year)
        .eq("period_month", month)
        .order("due_date", { ascending: true }),
      supabase
        .from("recurring_expenses")
        .select(
          "id, name, amount, paycheck_period, due_day, is_active, notes, subcategory_id, account_id, user_id",
        )
        .eq("family_id", familyId)
        .order("name"),
      supabase
        .from("variable_expenses")
        .select(
          "id, description, amount, date, category_id, subcategory_id, user_id",
        )
        .eq("family_id", familyId)
        .gte("date", monthStart)
        .lte("date", monthEnd)
        .order("date", { ascending: false }),
    ]);

    for (const r of [
      categoriesRes,
      subcategoriesRes,
      accountsRes,
      recordsRes,
      recurringRes,
      variableRes,
    ]) {
      if (r.error) throw r.error;
    }

    const categories = (categoriesRes.data ?? []) as CategoryOption[];
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const subcategories = (subcategoriesRes.data ?? []).filter(Boolean);
    const subById = new Map(
      subcategories.map((s) => [
        s.id as string,
        {
          id: s.id as string,
          category_id: s.category_id as string,
          name: s.name as string,
        },
      ]),
    );
    const accById = new Map(
      (accountsRes.data ?? []).map((a) => [
        a.id as string,
        {
          id: a.id as string,
          name: a.name as string,
          color: (a.color as string) ?? "#6366f1",
        },
      ]),
    );

    const expenseRecords: PaycheckRecordRow[] = (recordsRes.data ?? []).map(
      (r) => {
        const sub = subById.get(r.subcategory_id as string);
        const cat = sub ? categoryById.get(sub.category_id) : undefined;
        return {
          id: r.id as string,
          name: r.name as string,
          amount: num(r.amount),
          due_date: r.due_date as string,
          status: r.status as PaycheckRecordRow["status"],
          paid_date: (r.paid_date as string | null) ?? null,
          paycheck_period: r.paycheck_period as 1 | 2,
          subcategoryName: sub?.name ?? "—",
          categoryName:
            cat?.[locale === "es" ? "name_es" : "name_en"] ?? "—",
          categoryColor: cat?.color ?? "#64748b",
          accountName: accById.get(r.account_id as string)?.name ?? "—",
          creatorInitial: householdCreatorInitial(
            r.user_id as string,
            emailByUserId,
          ),
          recurringExpenseId: (r.recurring_expense_id as string | null) ?? null,
        };
      },
    );

    const recurringTemplates: RecurringTemplateRow[] = (
      recurringRes.data ?? []
    ).map((r) => {
      const sub = subById.get(r.subcategory_id as string);
      const cat = sub ? categoryById.get(sub.category_id) : undefined;
      return {
        id: r.id as string,
        name: r.name as string,
        amount: num(r.amount),
        paycheck_period: r.paycheck_period as 1 | 2,
        due_day: r.due_day != null ? Number(r.due_day) : null,
        is_active: Boolean(r.is_active),
        notes: (r.notes as string | null) ?? null,
        subcategoryName: sub?.name ?? "—",
        categoryId: sub?.category_id ?? "",
        categoryName:
          cat?.[locale === "es" ? "name_es" : "name_en"] ?? "—",
        categoryColor: cat?.color ?? "#64748b",
        accountName: accById.get(r.account_id as string)?.name ?? "—",
        accountId: r.account_id as string,
        creatorInitial: householdCreatorInitial(
          r.user_id as string,
          emailByUserId,
        ),
      };
    });

    const variableExpenses: VariableExpenseRow[] = (variableRes.data ?? []).map(
      (v) => {
        const cat = categoryById.get(v.category_id as string);
        const sub = v.subcategory_id
          ? subById.get(v.subcategory_id as string)
          : undefined;
        return {
          id: v.id as string,
          description: v.description as string,
          amount: num(v.amount),
          date: v.date as string,
          categoryId: v.category_id as string,
          categoryName:
            cat?.[locale === "es" ? "name_es" : "name_en"] ?? "—",
          categoryColor: cat?.color ?? "#64748b",
          subcategoryName: sub?.name ?? null,
          creatorInitial: householdCreatorInitial(
            v.user_id as string,
            emailByUserId,
          ),
        };
      },
    );

    return {
      data: {
        year,
        month,
        locale,
        categories,
        subcategories: subcategories.map((s) => ({
          id: s.id as string,
          category_id: s.category_id as string,
          name: s.name as string,
        })),
        accounts: [...accById.values()],
        expenseRecords,
        recurringTemplates,
        variableExpenses,
      },
      error: null,
    };
  } catch (e) {
    const message = errorMessageFromUnknown(e);
    return { data: null, error: message };
  }
}

export async function fetchExpenseRecordHistory(
  supabase: SupabaseClient,
  recurringExpenseId: string,
): Promise<{ data: ExpenseHistoryRow[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("expense_records")
      .select("id, amount, status, paid_date, period_year, period_month")
      .eq("recurring_expense_id", recurringExpenseId)
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false })
      .limit(12);
    if (error) throw error;
    return {
      data: (data ?? []).map((r) => ({
        id: r.id as string,
        amount: num(r.amount),
        status: r.status as string,
        paid_date: (r.paid_date as string | null) ?? null,
        period_year: Number(r.period_year),
        period_month: Number(r.period_month),
      })),
      error: null,
    };
  } catch (e) {
    return {
      data: [],
      error: errorMessageFromUnknown(e),
    };
  }
}

export type HouseholdProfile = {
  id: string;
  email: string;
  full_name: string | null;
  person: ReturnType<typeof personFromEmail>;
};

export async function fetchHouseholdProfiles(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name");
  if (error) return { data: [] as HouseholdProfile[], error: error.message };
  const rows = (data ?? [])
    .filter((p) => personFromEmail(p.email as string) !== "unknown")
    .map((p) => ({
      id: p.id as string,
      email: p.email as string,
      full_name: (p.full_name as string | null) ?? null,
      person: personFromEmail(p.email as string),
    }));
  return { data: rows, error: null };
}
