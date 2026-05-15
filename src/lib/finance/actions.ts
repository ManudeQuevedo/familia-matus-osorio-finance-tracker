"use server";

import { revalidatePath } from "next/cache";

import {
  addMonthsToDate,
  estimatePayoffMonths,
} from "@/lib/finance/debt-calculations";
import { computeGoalMetrics } from "@/lib/finance/goal-calculations";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  const { error } = await supabase
    .from("expense_records")
    .update({
      status: "paid",
      paid_date: todayIsoDate(),
    })
    .eq("id", recordId)
    .eq("user_id", user.id);
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
  const { error } = await supabase
    .from("expense_records")
    .update({ amount: input.amount })
    .eq("id", input.recordId)
    .eq("user_id", user.id);
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

  const { data: recurring, error: recErr } = await supabase
    .from("recurring_expenses")
    .insert({
      user_id: user.id,
      subcategory_id: input.subcategoryId,
      account_id: input.accountId,
      name: input.name.trim(),
      amount: input.amount,
      paycheck_period: input.paycheckPeriod,
      due_day: input.dueDay,
      is_active: input.isActive,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (recErr || !recurring) {
    return { ok: false as const, error: recErr?.message ?? "insert_failed" };
  }

  const dueDate = dueDateForMonth(
    input.year,
    input.month,
    input.dueDay,
    input.paycheckPeriod,
  );

  const { error: recordErr } = await supabase.from("expense_records").insert({
    user_id: user.id,
    recurring_expense_id: recurring.id,
    subcategory_id: input.subcategoryId,
    account_id: input.accountId,
    name: input.name.trim(),
    amount: input.amount,
    period_year: input.year,
    period_month: input.month,
    paycheck_period: input.paycheckPeriod,
    due_date: dueDate,
    status: "pending",
    is_recurring: true,
    notes: input.notes?.trim() || null,
  });

  if (recordErr) {
    return { ok: false as const, error: recordErr.message };
  }

  revalidateFinancePaths(input.locale);
  return { ok: true as const };
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
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "unauthorized" };
  }
  const desc = input.description.trim() || " ";
  const { error } = await supabase.from("variable_expenses").insert({
    user_id: user.id,
    category_id: input.categoryId,
    subcategory_id: input.subcategoryId,
    amount: input.amount,
    description: desc,
    date: input.date,
  });
  if (error) {
    return { ok: false as const, error: error.message };
  }
  revalidateFinancePaths(input.locale);
  return { ok: true as const };
}

export async function deleteVariableExpense(id: string, locale: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "unauthorized" };
  }
  const { error } = await supabase
    .from("variable_expenses")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    return { ok: false as const, error: error.message };
  }
  revalidateFinancePaths(locale);
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
    .eq("user_id", user.id)
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

  const isUsd =
    input.amountUsd != null &&
    input.exchangeRate != null &&
    input.amountUsd > 0;

  const payload = {
    user_id: input.personUserId,
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

  const { data: debt, error: debtErr } = await supabase
    .from("debts")
    .select(
      "id, current_balance, monthly_payment, interest_rate",
    )
    .eq("id", input.debtId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (debtErr || !debt) {
    return { ok: false as const, error: debtErr?.message ?? "not_found" };
  }

  const balanceBefore = Number(debt.current_balance);
  const balanceAfter = Math.max(0, balanceBefore - input.amountPaid);

  const { error: payErr } = await supabase.from("debt_payments").insert({
    debt_id: input.debtId,
    user_id: user.id,
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

export async function activateDebtPlan(input: {
  locale: string;
  active: boolean;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "unauthorized" };

  const { data: debts, error: listErr } = await supabase
    .from("debts")
    .select("id, ai_plan")
    .eq("user_id", user.id);

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
