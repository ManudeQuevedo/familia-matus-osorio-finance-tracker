import type { SupabaseClient } from "@supabase/supabase-js";

import type { AppLocale } from "@/lib/finance/dashboard-queries";
import {
  addMonthsToDate,
  estimatePayoffMonths,
  payoffProgress,
} from "@/lib/finance/debt-calculations";
import { num } from "@/lib/finance/format";
import { householdCreatorInitial } from "@/lib/finance/household";
import { getFamilyIdForUser } from "@/lib/supabase/family-core";
import { errorMessageFromUnknown } from "@/lib/supabase/error-message";

export type DebtStatus = "active" | "paid_off";

export type DebtPaymentListItem = {
  id: string;
  debt_id: string;
  amount_paid: number;
  payment_date: string;
  notes: string | null;
  creatorInitial: string;
};

export type DebtListItem = {
  id: string;
  name: string;
  total_amount: number;
  current_balance: number;
  monthly_payment: number;
  interest_rate: number | null;
  due_day: number;
  start_date: string;
  estimated_payoff_date: string | null;
  status: DebtStatus;
  notes: string | null;
  ai_plan: Record<string, unknown>;
  payoffMonths: number;
  payoffProgressPercent: number;
  isOwner: boolean;
  creatorInitial: string;
};

export type DebtsSnapshot = {
  locale: AppLocale;
  debts: DebtListItem[];
  payments: DebtPaymentListItem[];
  summary: {
    totalDebt: number;
    totalMonthlyPayments: number;
    monthlyIncome: number;
    incomePercentToDebts: number;
  };
  planActive: boolean;
};

export async function fetchDebtsSnapshot(
  supabase: SupabaseClient,
  args: {
    userId: string;
    year: number;
    month: number;
    locale: AppLocale;
  },
): Promise<{ data: DebtsSnapshot | null; error: string | null }> {
  const { userId, year, month, locale } = args;

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

    const [debtsRes, incomesRes, paymentsRes] = await Promise.all([
      supabase
        .from("debts")
        .select(
          "id, user_id, name, total_amount, current_balance, monthly_payment, interest_rate, due_day, start_date, estimated_payoff_date, status, notes, ai_plan",
        )
        .eq("family_id", familyId)
        .order("current_balance", { ascending: false }),
      supabase
        .from("incomes")
        .select("amount_mxn")
        .eq("family_id", familyId)
        .eq("period_year", year)
        .eq("period_month", month),
      supabase
        .from("debt_payments")
        .select("id, debt_id, amount_paid, payment_date, notes, user_id")
        .eq("family_id", familyId)
        .order("payment_date", { ascending: false })
        .limit(300),
    ]);

    if (debtsRes.error) throw debtsRes.error;
    if (incomesRes.error) throw incomesRes.error;
    if (paymentsRes.error) throw paymentsRes.error;

    const monthlyIncome = (incomesRes.data ?? []).reduce(
      (s, r) => s + num(r.amount_mxn),
      0,
    );

    let planActive = false;
    const debts: DebtListItem[] = (debtsRes.data ?? []).map((d) => {
      const balance = num(d.current_balance);
      const total = num(d.total_amount);
      const payment = num(d.monthly_payment);
      const rate =
        d.interest_rate != null ? num(d.interest_rate) : null;
      const months = estimatePayoffMonths(balance, payment, rate);
      const estimated =
        (d.estimated_payoff_date as string | null) ??
        (months < 999 && balance > 0
          ? addMonthsToDate(new Date().toISOString().slice(0, 10), months)
          : null);

      const aiPlan = (d.ai_plan as Record<string, unknown>) ?? {};
      if (aiPlan.active === true) planActive = true;

      return {
        id: d.id as string,
        name: d.name as string,
        total_amount: total,
        current_balance: balance,
        monthly_payment: payment,
        interest_rate: rate,
        due_day: Number(d.due_day),
        start_date: d.start_date as string,
        estimated_payoff_date: estimated,
        status: d.status as DebtStatus,
        notes: (d.notes as string | null) ?? null,
        ai_plan: aiPlan,
        payoffMonths: months,
        payoffProgressPercent: payoffProgress(total, balance),
        isOwner: (d.user_id as string) === userId,
        creatorInitial: householdCreatorInitial(
          d.user_id as string,
          emailByUserId,
        ),
      };
    });

    const activeDebts = debts.filter((d) => d.status === "active");
    const totalDebt = activeDebts.reduce((s, d) => s + d.current_balance, 0);
    const totalMonthlyPayments = activeDebts.reduce(
      (s, d) => s + d.monthly_payment,
      0,
    );

    const payments: DebtPaymentListItem[] = (paymentsRes.data ?? []).map(
      (p) => ({
        id: p.id as string,
        debt_id: p.debt_id as string,
        amount_paid: num(p.amount_paid),
        payment_date: p.payment_date as string,
        notes: (p.notes as string | null) ?? null,
        creatorInitial: householdCreatorInitial(
          p.user_id as string,
          emailByUserId,
        ),
      }),
    );

    return {
      data: {
        locale,
        debts,
        payments,
        summary: {
          totalDebt,
          totalMonthlyPayments,
          monthlyIncome,
          incomePercentToDebts:
            monthlyIncome > 0
              ? (totalMonthlyPayments / monthlyIncome) * 100
              : 0,
        },
        planActive,
      },
      error: null,
    };
  } catch (e) {
    const message = errorMessageFromUnknown(e);
    return { data: null, error: message };
  }
}
