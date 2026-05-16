"use server";

import { revalidatePath } from "next/cache";

import {
  addMonthsToDate,
  estimatePayoffMonths,
} from "@/lib/finance/debt-calculations";
import { computeGoalMetrics } from "@/lib/finance/goal-calculations";
import type { ExpenseFrequency } from "@/lib/finance/dashboard-queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFamilyIdForUser } from "@/lib/supabase/family-core";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function revalidateFinancePaths(locale: string) {
  const paths = [
    `/${locale}/dashboard`,
    `/${locale}/expenses`,
    `/${locale}/incomes`,
    `/${locale}/reports`,
    `/${locale}/goals`,
    `/${locale}/debts`,
  ];
  for (const p of paths) {
    revalidatePath(p, "page");
  }
}

export async function markExpenseRecordPaid(recordId: string, locale: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "unauthorized" };
  }
  const familyId = await getFamilyIdForUser(supabase, user.id);
  if (!familyId) {
    return { ok: false as const, error: "family_not_configured" };
  }
  const { error } = await supabase
    .from("expense_records")
    .update({
      status: "paid",
      paid_date: todayIsoDate(),
    })
    .eq("id", recordId)
    .eq("family_id", familyId);
  if (error) {
    return { ok: false as const, error: error.message };
  }
  revalidateFinancePaths(locale);
  return { ok: true as const };
}

export async function updateExpenseRecordPaidAmount(input: {
  locale: string;
  recordId: string;
  amount: number;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "unauthorized" };
  }
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    return { ok: false as const, error: "invalid_amount" };
  }
  const familyId = await getFamilyIdForUser(supabase, user.id);
  if (!familyId) {
    return { ok: false as const, error: "family_not_configured" };
  }
  const { error } = await supabase
    .from("expense_records")
    .update({ amount: input.amount })
    .eq("id", input.recordId)
    .eq("family_id", familyId);
  if (error) {
    return { ok: false as const, error: error.message };
  }
  revalidateFinancePaths(input.locale);
  return { ok: true as const };
}

function dueDateForMonth(
  year: number,
  month: number,
  dueDay: number | null,
  paycheckPeriod: 1 | 2,
): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  if (dueDay != null) {
    const last = new Date(year, month, 0).getDate();
    const day = Math.min(dueDay, last);
    return `${year}-${pad(month)}-${pad(day)}`;
  }
  return paycheckPeriod === 2
    ? `${year}-${pad(month)}-07`
    : `${year}-${pad(month)}-22`;
}

type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function insertSingleRecurringTemplate(
  supabase: SupabaseServer,
  args: {
    userId: string;
    familyId: string;
    name: string;
    subcategoryId: string;
    accountId: string;
    amount: number;
    paycheckPeriod: 1 | 2;
    dueDay: number | null;
    isActive: boolean;
    notes: string | null;
    year: number;
    month: number;
    frequency: ExpenseFrequency;
    templateKind: "recurring" | "planned";
    /** For sheet import: seed the current month record as paid or pending. */
    expenseRecordStatus?: "paid" | "pending";
    expensePaidDate?: string | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: recurring, error: recErr } = await supabase
    .from("recurring_expenses")
    .insert({
      user_id: args.userId,
      family_id: args.familyId,
      subcategory_id: args.subcategoryId,
      account_id: args.accountId,
      name: args.name.trim(),
      amount: args.amount,
      paycheck_period: args.paycheckPeriod,
      due_day: args.dueDay,
      is_active: args.isActive,
      notes: args.notes,
      frequency: args.frequency,
      template_kind: args.templateKind,
    })
    .select("id")
    .single();

  if (recErr || !recurring) {
    return { ok: false as const, error: recErr?.message ?? "insert_failed" };
  }

  const dueDate = dueDateForMonth(
    args.year,
    args.month,
    args.dueDay,
    args.paycheckPeriod,
  );

  const expense_type =
    args.templateKind === "planned" ? "planned" : "recurring";

  const recordStatus = args.expenseRecordStatus ?? "pending";
  const paidDate =
    recordStatus === "paid"
      ? (args.expensePaidDate ?? todayIsoDate())
      : null;

  const { error: recordErr } = await supabase.from("expense_records").insert({
    user_id: args.userId,
    family_id: args.familyId,
    recurring_expense_id: recurring.id,
    subcategory_id: args.subcategoryId,
    account_id: args.accountId,
    name: args.name.trim(),
    amount: args.amount,
    period_year: args.year,
    period_month: args.month,
    paycheck_period: args.paycheckPeriod,
    due_date: dueDate,
    status: recordStatus,
    paid_date: paidDate,
    is_recurring: args.templateKind === "recurring",
    notes: args.notes,
    expense_type,
  });

  if (recordErr) {
    return { ok: false as const, error: recordErr.message };
  }
  return { ok: true as const };
}

export async function createRecurringExpense(input: {
  locale: string;
  name: string;
  subcategoryId: string;
  accountId: string;
  amount: number;
  paycheckPeriod: 1 | 2;
  dueDay: number | null;
  isActive: boolean;
  notes?: string;
  year: number;
  month: number;
  frequency?: ExpenseFrequency;
  templateKind?: "recurring" | "planned";
  paycheckBoth?: boolean;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "unauthorized" };
  }
  if (!input.name.trim() || input.amount < 0) {
    return { ok: false as const, error: "invalid_input" };
  }

  const familyId = await getFamilyIdForUser(supabase, user.id);
  if (!familyId) {
    return { ok: false as const, error: "family_not_configured" };
  }

  const frequency = input.frequency ?? "monthly";
  const templateKind = input.templateKind ?? "recurring";
  const notes = input.notes?.trim() || null;

  const dbPeriods: Array<1 | 2> = input.paycheckBoth
    ? [2, 1]
    : [input.paycheckPeriod];

  for (const paycheckPeriod of dbPeriods) {
    const res = await insertSingleRecurringTemplate(supabase, {
      userId: user.id,
      familyId,
      name: input.name,
      subcategoryId: input.subcategoryId,
      accountId: input.accountId,
      amount: input.amount,
      paycheckPeriod,
      dueDay: input.dueDay,
      isActive: input.isActive,
      notes,
      year: input.year,
      month: input.month,
      frequency,
      templateKind,
    });
    if (!res.ok) return res;
  }

  revalidateFinancePaths(input.locale);
  return { ok: true as const };
}

export type ImportRecurringExpenseRowInput = {
  name: string;
  subcategoryId: string;
  accountId: string;
  amount: number;
  paycheckPeriod: 1 | 2;
  dueDay: number | null;
  recordStatus: "paid" | "pending";
};

/** Import recurring expense templates + current month records from a spreadsheet. */
export async function importRecurringExpensesFromSheet(input: {
  locale: string;
  year: number;
  month: number;
  rows: ImportRecurringExpenseRowInput[];
}): Promise<{
  imported: number;
  failures: { name: string; error: string }[];
  error?: string;
}> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { imported: 0, failures: [], error: "unauthorized" };
  }
  const familyId = await getFamilyIdForUser(supabase, user.id);
  if (!familyId) {
    return { imported: 0, failures: [], error: "family_not_configured" };
  }

  let imported = 0;
  const failures: { name: string; error: string }[] = [];

  for (const row of input.rows) {
    if (
      !row.name?.trim() ||
      !Number.isFinite(row.amount) ||
      row.amount < 0 ||
      !row.subcategoryId ||
      !row.accountId
    ) {
      failures.push({
        name: row.name?.trim() || "—",
        error: "invalid_row",
      });
      continue;
    }
    const res = await insertSingleRecurringTemplate(supabase, {
      userId: user.id,
      familyId,
      name: row.name,
      subcategoryId: row.subcategoryId,
      accountId: row.accountId,
      amount: row.amount,
      paycheckPeriod: row.paycheckPeriod,
      dueDay: row.dueDay,
      isActive: true,
      notes: null,
      year: input.year,
      month: input.month,
      frequency: "monthly",
      templateKind: "recurring",
      expenseRecordStatus: row.recordStatus,
      expensePaidDate: row.recordStatus === "paid" ? todayIsoDate() : null,
    });
    if (!res.ok) {
      failures.push({ name: row.name, error: res.error });
    } else {
      imported++;
    }
  }

  if (imported > 0) {
    revalidateFinancePaths(input.locale);
  }

  return { imported, failures };
}

export async function createSubcategory(input: {
  locale: string;
  categoryId: string;
  name: string;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "unauthorized" };
  }
  const name = input.name.trim();
  if (!name) {
    return { ok: false as const, error: "invalid_name" };
  }
  const { data, error } = await supabase
    .from("subcategories")
    .insert({ category_id: input.categoryId, name })
    .select("id, category_id, name")
    .single();
  if (error) {
    return { ok: false as const, error: error.message };
  }
  revalidateFinancePaths(input.locale);
  return {
    ok: true as const,
    subcategory: {
      id: data.id as string,
      category_id: data.category_id as string,
      name: data.name as string,
    },
  };
}

export async function createQuickVariableExpense(input: {
  locale: string;
  amount: number;
  categoryId: string;
  subcategoryId: string | null;
  description: string;
  date: string;
  expense_type?: "unplanned" | "unexpected";
  type_id?: string | null;
  permanent_solution?: boolean;
  permanent_solution_note?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "unauthorized" };
  }
  const desc = input.description.trim() || " ";
  const familyId = await getFamilyIdForUser(supabase, user.id);
  if (!familyId) {
    return { ok: false as const, error: "family_not_configured" };
  }
  const { error } = await supabase.from("variable_expenses").insert({
    user_id: user.id,
    family_id: familyId,
    category_id: input.categoryId,
    subcategory_id: input.subcategoryId,
    amount: input.amount,
    description: desc,
    date: input.date,
    expense_type: input.expense_type ?? "unplanned",
    type_id: input.type_id ?? null,
    permanent_solution: input.permanent_solution ?? false,
    permanent_solution_note: input.permanent_solution_note?.trim() || null,
  });
  if (error) {
    return { ok: false as const, error: error.message };
  }
  revalidateFinancePaths(input.locale);
  return { ok: true as const };
}

export async function createCustomExpenseClassification(input: {
  locale: string;
  kind: "unplanned" | "unexpected";
  name: string;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "unauthorized" };
  }
  const name = input.name.trim();
  if (!name) {
    return { ok: false as const, error: "invalid_name" };
  }
  const familyId = await getFamilyIdForUser(supabase, user.id);
  if (!familyId) {
    return { ok: false as const, error: "family_not_configured" };
  }
  const table =
    input.kind === "unplanned"
      ? "unplanned_expense_types"
      : "unexpected_expense_types";
  const { data, error } = await supabase
    .from(table)
    .insert({
      family_id: familyId,
      name,
      icon: null,
      is_system: false,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false as const, error: error?.message ?? "insert_failed" };
  }
  revalidateFinancePaths(input.locale);
  return { ok: true as const, id: data.id as string };
}

export async function deleteVariableExpense(id: string, locale: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "unauthorized" };
  }
  const familyId = await getFamilyIdForUser(supabase, user.id);
  if (!familyId) {
    return { ok: false as const, error: "family_not_configured" };
  }
  const { error } = await supabase
    .from("variable_expenses")
    .delete()
    .eq("id", id)
    .eq("family_id", familyId);
  if (error) {
    return { ok: false as const, error: error.message };
  }
  revalidateFinancePaths(locale);
  return { ok: true as const };
}

/** Deletes template plus all linked expense_records for this recurring/planned row. */
export async function deleteRecurringExpenseTemplate(input: {
  locale: string;
  recurringExpenseId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "unauthorized" };
  }
  const familyId = await getFamilyIdForUser(supabase, user.id);
  if (!familyId) {
    return { ok: false as const, error: "family_not_configured" };
  }

  const { data: row } = await supabase
    .from("recurring_expenses")
    .select("id")
    .eq("id", input.recurringExpenseId)
    .eq("family_id", familyId)
    .maybeSingle();

  if (!row) {
    return { ok: false as const, error: "not_found" };
  }

  const { error: delRecordsErr } = await supabase
    .from("expense_records")
    .delete()
    .eq("recurring_expense_id", input.recurringExpenseId)
    .eq("family_id", familyId);

  if (delRecordsErr) {
    return { ok: false as const, error: delRecordsErr.message };
  }

  const { error } = await supabase
    .from("recurring_expenses")
    .delete()
    .eq("id", input.recurringExpenseId)
    .eq("family_id", familyId);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidateFinancePaths(input.locale);
  return { ok: true as const };
}

/** Removes a single expense record without deleting its recurring template. */
export async function deleteExpenseRecord(input: {
  locale: string;
  recordId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "unauthorized" };
  }
  const familyId = await getFamilyIdForUser(supabase, user.id);
  if (!familyId) {
    return { ok: false as const, error: "family_not_configured" };
  }

  const { error } = await supabase
    .from("expense_records")
    .delete()
    .eq("id", input.recordId)
    .eq("family_id", familyId);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidateFinancePaths(input.locale);
  return { ok: true as const };
}

export async function deleteCustomExpenseType(input: {
  locale: string;
  kind: "unplanned" | "unexpected";
  id: string;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "unauthorized" };
  }
  const familyId = await getFamilyIdForUser(supabase, user.id);
  if (!familyId) {
    return { ok: false as const, error: "family_not_configured" };
  }

  const table =
    input.kind === "unplanned"
      ? "unplanned_expense_types"
      : "unexpected_expense_types";
  const expenseType = input.kind === "unplanned" ? "unplanned" : "unexpected";

  await supabase
    .from("variable_expenses")
    .update({ type_id: null })
    .eq("family_id", familyId)
    .eq("expense_type", expenseType)
    .eq("type_id", input.id);

  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", input.id)
    .eq("family_id", familyId)
    .eq("is_system", false);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidateFinancePaths(input.locale);
  return { ok: true as const };
}

export async function createVariableExpense(input: {
  locale: string;
  amount: number;
  categoryId: string;
  subcategoryId: string | null;
  description: string;
  date: string;
}) {
  return createQuickVariableExpense(input);
}

export async function getRecurringExpenseHistory(recurringExpenseId: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "unauthorized", data: [] };
  }
  const { data, error } = await supabase
    .from("expense_records")
    .select("id, amount, status, paid_date, period_year, period_month")
    .eq("recurring_expense_id", recurringExpenseId)
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false })
    .limit(12);
  if (error) {
    return { ok: false as const, error: error.message, data: [] };
  }
  return {
    ok: true as const,
    data: (data ?? []).map((r) => ({
      id: r.id as string,
      amount: Number(r.amount),
      status: r.status as string,
      paid_date: (r.paid_date as string | null) ?? null,
      period_year: Number(r.period_year),
      period_month: Number(r.period_month),
    })),
  };
}

export async function createIncome(input: {
  locale: string;
  accountId: string;
  personUserId: string;
  type: "salary" | "bonus" | "other";
  amountMxn: number;
  amountUsd?: number;
  exchangeRate?: number;
  paycheckNumber?: 1 | 2 | null;
  receivedDate: string;
  notes?: string;
  year: number;
  month: number;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "unauthorized" };
  }

  const familyId = await getFamilyIdForUser(supabase, user.id);
  if (!familyId) {
    return { ok: false as const, error: "family_not_configured" };
  }

  const isUsd =
    input.amountUsd != null &&
    input.exchangeRate != null &&
    input.amountUsd > 0;

  const payload = {
    user_id: input.personUserId,
    family_id: familyId,
    account_id: input.accountId,
    type: input.type,
    amount_mxn: input.amountMxn,
    amount_original: isUsd ? input.amountUsd : input.amountMxn,
    original_currency: isUsd ? ("USD" as const) : ("MXN" as const),
    exchange_rate_used: isUsd ? input.exchangeRate : null,
    period_year: input.year,
    period_month: input.month,
    paycheck_number: input.paycheckNumber ?? null,
    received_date: input.receivedDate,
    notes: input.notes?.trim() || null,
  };

  const { error } = await supabase.from("incomes").insert(payload);
  if (error) {
    return { ok: false as const, error: error.message };
  }
  revalidateFinancePaths(input.locale);
  return { ok: true as const };
}

export async function createGoal(input: {
  locale: string;
  title: string;
  description?: string;
  icon: string;
  color: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  sharedGoal?: boolean;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "unauthorized" };

  const familyId = await getFamilyIdForUser(supabase, user.id);
  if (!familyId) {
    return { ok: false as const, error: "family_not_configured" };
  }

  const title = input.title.trim();
  if (!title || input.targetAmount < 0 || input.currentAmount < 0) {
    return { ok: false as const, error: "invalid_input" };
  }

  const metrics = computeGoalMetrics(
    input.targetAmount,
    input.currentAmount,
    input.targetDate,
  );
  const status =
    input.currentAmount >= input.targetAmount && input.targetAmount > 0
      ? "completed"
      : "active";

  const { error } = await supabase.from("goals").insert({
    user_id: user.id,
    family_id: familyId,
    title,
    description: input.description?.trim() || null,
    icon: input.icon,
    color: input.color,
    target_amount: input.targetAmount,
    current_amount: input.currentAmount,
    target_date: input.targetDate,
    monthly_required: metrics.monthlyRequired,
    status,
    shared_goal: input.sharedGoal ?? false,
  });

  if (error) return { ok: false as const, error: error.message };
  revalidateFinancePaths(input.locale);
  return { ok: true as const };
}

export async function addGoalContribution(input: {
  locale: string;
  goalId: string;
  amount: number;
  date: string;
  notes?: string;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "unauthorized" };
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false as const, error: "invalid_amount" };
  }

  const familyId = await getFamilyIdForUser(supabase, user.id);
  if (!familyId) {
    return { ok: false as const, error: "family_not_configured" };
  }

  const { data: goal, error: goalErr } = await supabase
    .from("goals")
    .select("id, current_amount, target_amount, target_date, status, user_id")
    .eq("id", input.goalId)
    .maybeSingle();

  if (goalErr || !goal) {
    return { ok: false as const, error: goalErr?.message ?? "not_found" };
  }

  const { error: contribErr } = await supabase.from("goal_contributions").insert({
    goal_id: input.goalId,
    user_id: user.id,
    family_id: familyId,
    amount: input.amount,
    date: input.date,
    notes: input.notes?.trim() || null,
  });
  if (contribErr) return { ok: false as const, error: contribErr.message };

  const newCurrent = Number(goal.current_amount) + input.amount;
  const target = Number(goal.target_amount);
  const metrics = computeGoalMetrics(
    target,
    newCurrent,
    goal.target_date as string,
  );
  const status =
    newCurrent >= target && target > 0
      ? "completed"
      : goal.status === "paused"
        ? "paused"
        : "active";

  const { error: updErr } = await supabase
    .from("goals")
    .update({
      current_amount: newCurrent,
      monthly_required: metrics.monthlyRequired,
      status,
    })
    .eq("id", input.goalId);

  if (updErr) return { ok: false as const, error: updErr.message };
  revalidateFinancePaths(input.locale);
  return { ok: true as const, goalCompleted: status === "completed" };
}

export async function createDebt(input: {
  locale: string;
  name: string;
  totalAmount: number;
  currentBalance: number;
  monthlyPayment: number;
  interestRate?: number | null;
  dueDay: number;
  notes?: string;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "unauthorized" };

  const familyId = await getFamilyIdForUser(supabase, user.id);
  if (!familyId) {
    return { ok: false as const, error: "family_not_configured" };
  }

  const name = input.name.trim();
  if (
    !name ||
    input.totalAmount < 0 ||
    input.currentBalance < 0 ||
    input.monthlyPayment < 0
  ) {
    return { ok: false as const, error: "invalid_input" };
  }

  const months = estimatePayoffMonths(
    input.currentBalance,
    input.monthlyPayment,
    input.interestRate,
  );
  const startDate = todayIsoDate();
  const estimatedPayoff =
    months < 999 && input.currentBalance > 0
      ? addMonthsToDate(startDate, months)
      : null;

  const { error } = await supabase.from("debts").insert({
    user_id: user.id,
    family_id: familyId,
    name,
    total_amount: input.totalAmount,
    current_balance: input.currentBalance,
    monthly_payment: input.monthlyPayment,
    interest_rate: input.interestRate ?? null,
    due_day: input.dueDay,
    start_date: startDate,
    estimated_payoff_date: estimatedPayoff,
    status: input.currentBalance <= 0 ? "paid_off" : "active",
    notes: input.notes?.trim() || null,
  });

  if (error) return { ok: false as const, error: error.message };
  revalidateFinancePaths(input.locale);
  return { ok: true as const };
}

export async function registerDebtPayment(input: {
  locale: string;
  debtId: string;
  amountPaid: number;
  paymentDate: string;
  isExtra: boolean;
  notes?: string;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "unauthorized" };
  if (!Number.isFinite(input.amountPaid) || input.amountPaid <= 0) {
    return { ok: false as const, error: "invalid_amount" };
  }

  const familyId = await getFamilyIdForUser(supabase, user.id);
  if (!familyId) {
    return { ok: false as const, error: "family_not_configured" };
  }

  const { data: debt, error: debtErr } = await supabase
    .from("debts")
    .select(
      "id, current_balance, monthly_payment, interest_rate",
    )
    .eq("id", input.debtId)
    .eq("family_id", familyId)
    .maybeSingle();

  if (debtErr || !debt) {
    return { ok: false as const, error: debtErr?.message ?? "not_found" };
  }

  const balanceBefore = Number(debt.current_balance);
  const balanceAfter = Math.max(0, balanceBefore - input.amountPaid);

  const { error: payErr } = await supabase.from("debt_payments").insert({
    debt_id: input.debtId,
    user_id: user.id,
    family_id: familyId,
    amount_paid: input.amountPaid,
    payment_date: input.paymentDate,
    balance_after: balanceAfter,
    notes: input.notes?.trim()
      ? `${input.isExtra ? "[extra] " : ""}${input.notes.trim()}`
      : input.isExtra
        ? "[extra]"
        : null,
  });
  if (payErr) return { ok: false as const, error: payErr.message };

  const months = estimatePayoffMonths(
    balanceAfter,
    Number(debt.monthly_payment),
    debt.interest_rate != null ? Number(debt.interest_rate) : null,
  );
  const estimatedPayoff =
    balanceAfter > 0 && months < 999
      ? addMonthsToDate(input.paymentDate, months)
      : null;

  const { error: updErr } = await supabase
    .from("debts")
    .update({
      current_balance: balanceAfter,
      estimated_payoff_date: estimatedPayoff,
      status: balanceAfter <= 0 ? "paid_off" : "active",
    })
    .eq("id", input.debtId);

  if (updErr) return { ok: false as const, error: updErr.message };
  revalidateFinancePaths(input.locale);
  return { ok: true as const, paidOff: balanceAfter <= 0 };
}

export async function deleteIncome(input: {
  locale: string;
  incomeId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "unauthorized" };
  }
  const familyId = await getFamilyIdForUser(supabase, user.id);
  if (!familyId) {
    return { ok: false as const, error: "family_not_configured" };
  }

  const { error } = await supabase
    .from("incomes")
    .delete()
    .eq("id", input.incomeId)
    .eq("family_id", familyId);

  if (error) {
    return { ok: false as const, error: error.message };
  }
  revalidateFinancePaths(input.locale);
  return { ok: true as const };
}

export async function deleteGoal(input: { locale: string; goalId: string }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "unauthorized" };
  }
  const familyId = await getFamilyIdForUser(supabase, user.id);
  if (!familyId) {
    return { ok: false as const, error: "family_not_configured" };
  }

  const { error } = await supabase
    .from("goals")
    .delete()
    .eq("id", input.goalId)
    .eq("family_id", familyId);

  if (error) {
    return { ok: false as const, error: error.message };
  }
  revalidateFinancePaths(input.locale);
  return { ok: true as const };
}

export async function deleteGoalContribution(input: {
  locale: string;
  contributionId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "unauthorized" };
  }
  const familyId = await getFamilyIdForUser(supabase, user.id);
  if (!familyId) {
    return { ok: false as const, error: "family_not_configured" };
  }

  const { data: contrib, error: cErr } = await supabase
    .from("goal_contributions")
    .select("id, goal_id, amount")
    .eq("id", input.contributionId)
    .eq("family_id", familyId)
    .maybeSingle();

  if (cErr || !contrib) {
    return { ok: false as const, error: cErr?.message ?? "not_found" };
  }

  const { data: goal, error: gErr } = await supabase
    .from("goals")
    .select("id, current_amount, target_amount, target_date, status")
    .eq("id", contrib.goal_id as string)
    .eq("family_id", familyId)
    .maybeSingle();

  if (gErr || !goal) {
    return { ok: false as const, error: gErr?.message ?? "goal_not_found" };
  }

  const amt = Number(contrib.amount);
  const target = Number(goal.target_amount);
  const newCurrent = Math.max(0, Number(goal.current_amount) - amt);
  const metrics = computeGoalMetrics(
    target,
    newCurrent,
    goal.target_date as string,
  );
  const status =
    newCurrent >= target && target > 0
      ? "completed"
      : goal.status === "paused"
        ? "paused"
        : "active";

  const { error: dErr } = await supabase
    .from("goal_contributions")
    .delete()
    .eq("id", input.contributionId)
    .eq("family_id", familyId);

  if (dErr) {
    return { ok: false as const, error: dErr.message };
  }

  const { error: uErr } = await supabase
    .from("goals")
    .update({
      current_amount: newCurrent,
      monthly_required: metrics.monthlyRequired,
      status,
    })
    .eq("id", contrib.goal_id as string);

  if (uErr) {
    return { ok: false as const, error: uErr.message };
  }

  revalidateFinancePaths(input.locale);
  return { ok: true as const };
}

export async function deleteDebt(input: { locale: string; debtId: string }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "unauthorized" };
  }
  const familyId = await getFamilyIdForUser(supabase, user.id);
  if (!familyId) {
    return { ok: false as const, error: "family_not_configured" };
  }

  const { error } = await supabase
    .from("debts")
    .delete()
    .eq("id", input.debtId)
    .eq("family_id", familyId);

  if (error) {
    return { ok: false as const, error: error.message };
  }
  revalidateFinancePaths(input.locale);
  return { ok: true as const };
}

export async function deleteDebtPayment(input: {
  locale: string;
  paymentId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "unauthorized" };
  }
  const familyId = await getFamilyIdForUser(supabase, user.id);
  if (!familyId) {
    return { ok: false as const, error: "family_not_configured" };
  }

  const { data: pay, error: pErr } = await supabase
    .from("debt_payments")
    .select("id, debt_id, amount_paid, payment_date")
    .eq("id", input.paymentId)
    .eq("family_id", familyId)
    .maybeSingle();

  if (pErr || !pay) {
    return { ok: false as const, error: pErr?.message ?? "not_found" };
  }

  const { data: debt, error: dErr } = await supabase
    .from("debts")
    .select("id, current_balance, monthly_payment, interest_rate")
    .eq("id", pay.debt_id as string)
    .eq("family_id", familyId)
    .maybeSingle();

  if (dErr || !debt) {
    return { ok: false as const, error: dErr?.message ?? "debt_not_found" };
  }

  const newBalance =
    Number(debt.current_balance) + Number(pay.amount_paid);

  const months = estimatePayoffMonths(
    newBalance,
    Number(debt.monthly_payment),
    debt.interest_rate != null ? Number(debt.interest_rate) : null,
  );
  const estimatedPayoff =
    newBalance > 0 && months < 999
      ? addMonthsToDate(pay.payment_date as string, months)
      : null;

  const { error: delErr } = await supabase
    .from("debt_payments")
    .delete()
    .eq("id", input.paymentId)
    .eq("family_id", familyId);

  if (delErr) {
    return { ok: false as const, error: delErr.message };
  }

  const { error: updErr } = await supabase
    .from("debts")
    .update({
      current_balance: newBalance,
      estimated_payoff_date: estimatedPayoff,
      status: newBalance <= 0 ? "paid_off" : "active",
    })
    .eq("id", pay.debt_id as string);

  if (updErr) {
    return { ok: false as const, error: updErr.message };
  }

  revalidateFinancePaths(input.locale);
  return { ok: true as const };
}

export async function activateDebtPlan(input: {
  locale: string;
  active: boolean;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "unauthorized" };

  const familyId = await getFamilyIdForUser(supabase, user.id);
  if (!familyId) {
    return { ok: false as const, error: "family_not_configured" };
  }

  const { data: debts, error: listErr } = await supabase
    .from("debts")
    .select("id, ai_plan")
    .eq("family_id", familyId);

  if (listErr) return { ok: false as const, error: listErr.message };

  for (const d of debts ?? []) {
    const plan = (d.ai_plan as Record<string, unknown>) ?? {};
    if (!plan.analysis && !plan.strategy) continue;
    const { error } = await supabase
      .from("debts")
      .update({
        ai_plan: { ...plan, active: input.active, activated_at: todayIsoDate() },
      })
      .eq("id", d.id as string);
    if (error) return { ok: false as const, error: error.message };
  }

  revalidateFinancePaths(input.locale);
  return { ok: true as const };
}
