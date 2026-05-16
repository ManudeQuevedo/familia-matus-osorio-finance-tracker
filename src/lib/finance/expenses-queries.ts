import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AppLocale,
  CategoryOption,
  ExpenseFrequency,
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
  frequency: ExpenseFrequency;
  template_kind: "recurring" | "planned";
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
  expense_type: "unplanned" | "unexpected";
  typeId: string | null;
  typeName: string | null;
  typeIcon: string | null;
  permanentSolution: boolean;
  permanentSolutionNote: string | null;
};

export type ExpenseClassificationOption = {
  id: string;
  name: string;
  icon: string | null;
  is_system: boolean;
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
  unplannedTypes: ExpenseClassificationOption[];
  unexpectedTypes: ExpenseClassificationOption[];
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
      unplannedTypesRes,
      unexpectedTypesRes,
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
          "id, name, amount, due_date, status, paid_date, paycheck_period, subcategory_id, account_id, recurring_expense_id, user_id, expense_type",
        )
        .eq("family_id", familyId)
        .eq("period_year", year)
        .eq("period_month", month)
        .order("due_date", { ascending: true }),
      supabase
        .from("recurring_expenses")
        .select(
          "id, name, amount, paycheck_period, due_day, is_active, notes, subcategory_id, account_id, user_id, frequency, template_kind",
        )
        .eq("family_id", familyId)
        .order("name"),
      supabase
        .from("variable_expenses")
        .select(
          "id, description, amount, date, category_id, subcategory_id, user_id, expense_type, type_id, permanent_solution, permanent_solution_note",
        )
        .eq("family_id", familyId)
        .gte("date", monthStart)
        .lte("date", monthEnd)
        .order("date", { ascending: false }),
      supabase
        .from("unplanned_expense_types")
        .select("id, name, icon, is_system")
        .eq("family_id", familyId)
        .order("name"),
      supabase
        .from("unexpected_expense_types")
        .select("id, name, icon, is_system")
        .eq("family_id", familyId)
        .order("name"),
    ]);

    for (const r of [
      categoriesRes,
      subcategoriesRes,
      accountsRes,
      recordsRes,
      recurringRes,
      variableRes,
      unplannedTypesRes,
      unexpectedTypesRes,
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

    const unplannedTypes: ExpenseClassificationOption[] = (
      unplannedTypesRes.data ?? []
    ).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      icon: (row.icon as string | null) ?? null,
      is_system: Boolean(row.is_system),
    }));
    const unexpectedTypes: ExpenseClassificationOption[] = (
      unexpectedTypesRes.data ?? []
    ).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      icon: (row.icon as string | null) ?? null,
      is_system: Boolean(row.is_system),
    }));

    const unplannedById = new Map(unplannedTypes.map((t) => [t.id, t]));
    const unexpectedById = new Map(unexpectedTypes.map((t) => [t.id, t]));

    const freqByRecurringId = new Map(
      (recurringRes.data ?? []).map((row) => [
        row.id as string,
        ((row.frequency as string | null) ?? "monthly") as ExpenseFrequency,
      ]),
    );

    const expenseRecords: PaycheckRecordRow[] = (recordsRes.data ?? []).map(
      (r) => {
        const sub = subById.get(r.subcategory_id as string);
        const cat = sub ? categoryById.get(sub.category_id) : undefined;
        const rid = (r.recurring_expense_id as string | null) ?? null;
        const expenseTypeRaw = r.expense_type as string | null | undefined;
        const expense_type: PaycheckRecordRow["expense_type"] =
          expenseTypeRaw === "planned"
            ? "planned"
            : expenseTypeRaw === "unplanned"
              ? "unplanned"
              : expenseTypeRaw === "unexpected"
                ? "unexpected"
                : "recurring";
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
          recurringExpenseId: rid,
          expense_type,
          frequency: rid ? freqByRecurringId.get(rid) ?? "monthly" : null,
        };
      },
    );

    const recurringTemplates: RecurringTemplateRow[] = (
      recurringRes.data ?? []
    ).map((r) => {
      const sub = subById.get(r.subcategory_id as string);
      const cat = sub ? categoryById.get(sub.category_id) : undefined;
      const tk = (r.template_kind as string | null) ?? "recurring";
      return {
        id: r.id as string,
        name: r.name as string,
        amount: num(r.amount),
        paycheck_period: r.paycheck_period as 1 | 2,
        due_day: r.due_day != null ? Number(r.due_day) : null,
        is_active: Boolean(r.is_active),
        notes: (r.notes as string | null) ?? null,
        frequency:
          ((r.frequency as string | null) ?? "monthly") as ExpenseFrequency,
        template_kind: tk === "planned" ? "planned" : "recurring",
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
        const vt =
          ((v.expense_type as string | null) ?? "unplanned") === "unexpected"
            ? "unexpected"
            : "unplanned";
        const tid = (v.type_id as string | null) ?? null;
        const meta =
          vt === "unplanned"
            ? tid
              ? unplannedById.get(tid)
              : undefined
            : tid
              ? unexpectedById.get(tid)
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
          expense_type: vt,
          typeId: tid,
          typeName: meta?.name ?? null,
          typeIcon: meta?.icon ?? null,
          permanentSolution: Boolean(v.permanent_solution),
          permanentSolutionNote:
            (v.permanent_solution_note as string | null) ?? null,
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
        unplannedTypes,
        unexpectedTypes,
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
