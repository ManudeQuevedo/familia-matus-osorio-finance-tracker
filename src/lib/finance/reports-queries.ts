import type { SupabaseClient } from "@supabase/supabase-js";

import type { AppLocale } from "@/lib/finance/dashboard-queries";
import { num } from "@/lib/finance/format";
import { errorMessageFromUnknown } from "@/lib/supabase/error-message";

export type ReportPeriodType = "monthly" | "quarterly" | "annual";

export type CategoryReportRow = {
  categoryId: string;
  name: string;
  color: string;
  amount: number;
  percentOfIncome: number;
};

export type MonthTrendRow = {
  year: number;
  month: number;
  label: string;
  income: number;
  expenses: number;
  savings: number;
};

export type QuincenaCompareRow = {
  year: number;
  month: number;
  label: string;
  q1: number;
  q2: number;
};

export type TopExpenseRow = {
  id: string;
  name: string;
  amount: number;
  categoryName: string;
  date: string;
  kind: "recurring" | "variable";
};

export type CategoryTrendRow = {
  categoryId: string;
  name: string;
  color: string;
  current: number;
  previous: number;
  changePercent: number;
};

export type ReportsSnapshot = {
  periodType: ReportPeriodType;
  year: number;
  month: number;
  locale: AppLocale;
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  savingsRate: number;
  byCategory: CategoryReportRow[];
  monthlyTrend: MonthTrendRow[];
  quincenaCompare: QuincenaCompareRow[];
  topExpenses: TopExpenseRow[];
  categoryTrends: CategoryTrendRow[];
};

function monthRange(year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = `${year}-${pad(month)}-01`;
  const last = new Date(year, month, 0).getDate();
  const end = `${year}-${pad(month)}-${pad(last)}`;
  return { start, end };
}

function monthsInPeriod(
  periodType: ReportPeriodType,
  year: number,
  month: number,
): { year: number; month: number }[] {
  if (periodType === "monthly") {
    return [{ year, month }];
  }
  if (periodType === "quarterly") {
    const qStart = Math.floor((month - 1) / 3) * 3 + 1;
    return [0, 1, 2].map((i) => {
      let m = qStart + i;
      let y = year;
      if (m > 12) {
        m -= 12;
        y += 1;
      }
      return { year: y, month: m };
    });
  }
  return Array.from({ length: 12 }, (_, i) => ({
    year,
    month: i + 1,
  }));
}

function trendMonthsBack(
  periodType: ReportPeriodType,
  year: number,
  month: number,
  count: number,
): { year: number; month: number }[] {
  const anchor = periodType === "annual" ? { year, month: 12 } : { year, month };
  const out: { year: number; month: number }[] = [];
  let y = anchor.year;
  let m = anchor.month;
  for (let i = 0; i < count; i++) {
    out.unshift({ year: y, month: m });
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

function monthLabel(locale: AppLocale, year: number, month: number) {
  return new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    month: "short",
    year: "2-digit",
  }).format(new Date(year, month - 1, 1));
}

export async function fetchReportsSnapshot(
  supabase: SupabaseClient,
  args: {
    periodType: ReportPeriodType;
    year: number;
    month: number;
    locale: AppLocale;
  },
): Promise<{ data: ReportsSnapshot | null; error: string | null }> {
  const { periodType, year, month, locale } = args;

  try {
    const periodMonths = monthsInPeriod(periodType, year, month);
    const trendMonths =
      periodType === "annual"
        ? trendMonthsBack("annual", year, 12, 12)
        : trendMonthsBack(periodType, year, month, 6);

    const [categoriesRes, subRes] = await Promise.all([
      supabase
        .from("categories")
        .select("id, name_es, name_en, color")
        .in("type", ["expense", "both"]),
      supabase.from("subcategories").select("id, category_id"),
    ]);
    if (categoriesRes.error) throw categoriesRes.error;
    if (subRes.error) throw subRes.error;
    const categories = categoriesRes.data ?? [];
    const catName = (id: string) => {
      const c = categories.find((x) => x.id === id);
      if (!c) return "—";
      return locale === "es" ? (c.name_es as string) : (c.name_en as string);
    };
    const catColor = (id: string) =>
      (categories.find((x) => x.id === id)?.color as string) ?? "#64748b";

    const subToCat = new Map(
      (subRes.data ?? []).map((s) => [s.id as string, s.category_id as string]),
    );

    let totalIncome = 0;
    let totalExpenses = 0;
    const categoryTotals = new Map<string, number>();
    const monthlyIncome = new Map<string, number>();
    const monthlyExpense = new Map<string, number>();
    const quincenaByMonth = new Map<string, { q1: number; q2: number }>();
    const allExpenses: TopExpenseRow[] = [];

    const prevMonths = monthsInPeriod(
      periodType,
      periodMonths[0]!.month === 1
        ? periodMonths[0]!.year - 1
        : periodMonths[0]!.year,
      periodMonths[0]!.month === 1 ? 12 : periodMonths[0]!.month - 1,
    );
    const prevCategoryTotals = new Map<string, number>();

    const fetchMonthData = async (y: number, m: number, intoPrev = false) => {
      const key = `${y}-${m}`;
      const { start, end } = monthRange(y, m);

      const [incRes, recRes, varRes] = await Promise.all([
        supabase
          .from("incomes")
          .select("amount_mxn")
          .eq("period_year", y)
          .eq("period_month", m),
        supabase
          .from("expense_records")
          .select(
            "id, name, amount, due_date, paycheck_period, subcategory_id",
          )
          .eq("period_year", y)
          .eq("period_month", m),
        supabase
          .from("variable_expenses")
          .select("id, description, amount, date, category_id")
          .gte("date", start)
          .lte("date", end),
      ]);
      if (incRes.error) throw incRes.error;
      if (recRes.error) throw recRes.error;
      if (varRes.error) throw varRes.error;

      const income = (incRes.data ?? []).reduce(
        (s, r) => s + num(r.amount_mxn),
        0,
      );
      const recurring = (recRes.data ?? []).reduce(
        (s, r) => s + num(r.amount),
        0,
      );
      const variable = (varRes.data ?? []).reduce(
        (s, r) => s + num(r.amount),
        0,
      );
      const expenses = recurring + variable;

      if (!intoPrev) {
        totalIncome += income;
        totalExpenses += expenses;
        monthlyIncome.set(key, (monthlyIncome.get(key) ?? 0) + income);
        monthlyExpense.set(key, (monthlyExpense.get(key) ?? 0) + expenses);

        const q = { q1: 0, q2: 0 };
        for (const r of recRes.data ?? []) {
          const amt = num(r.amount);
          if (r.paycheck_period === 1) q.q2 += amt;
          else q.q1 += amt;
        }
        quincenaByMonth.set(key, q);

        for (const r of recRes.data ?? []) {
          const catId =
            subToCat.get(r.subcategory_id as string) ?? "unknown";
          if (!intoPrev) {
            categoryTotals.set(
              catId,
              (categoryTotals.get(catId) ?? 0) + num(r.amount),
            );
          }
          allExpenses.push({
            id: r.id as string,
            name: r.name as string,
            amount: num(r.amount),
            categoryName: catName(catId),
            date: r.due_date as string,
            kind: "recurring",
          });
        }
        for (const r of varRes.data ?? []) {
          const catId = r.category_id as string;
          categoryTotals.set(
            catId,
            (categoryTotals.get(catId) ?? 0) + num(r.amount),
          );
          allExpenses.push({
            id: r.id as string,
            name: r.description as string,
            amount: num(r.amount),
            categoryName: catName(catId),
            date: r.date as string,
            kind: "variable",
          });
        }
      } else {
        for (const r of recRes.data ?? []) {
          const catId = subToCat.get(r.subcategory_id as string) ?? "unknown";
          prevCategoryTotals.set(
            catId,
            (prevCategoryTotals.get(catId) ?? 0) + num(r.amount),
          );
        }
        for (const r of varRes.data ?? []) {
          const catId = r.category_id as string;
          prevCategoryTotals.set(
            catId,
            (prevCategoryTotals.get(catId) ?? 0) + num(r.amount),
          );
        }
      }
    };

    await Promise.all([
      ...periodMonths.map(({ year: y, month: m }) => fetchMonthData(y, m)),
      ...prevMonths.map(({ year: y, month: m }) => fetchMonthData(y, m, true)),
    ]);

    await Promise.all(
      trendMonths
        .filter(({ year: y, month: m }) => {
          const key = `${y}-${m}`;
          return !monthlyIncome.has(key) || !monthlyExpense.has(key);
        })
        .map(({ year: y, month: m }) => fetchMonthData(y, m)),
    );

    const byCategory: CategoryReportRow[] = [...categoryTotals.entries()]
      .filter(([id]) => id !== "unknown")
      .map(([categoryId, amount]) => ({
        categoryId,
        name: catName(categoryId),
        color: catColor(categoryId),
        amount,
        percentOfIncome:
          totalIncome > 0 ? (amount / totalIncome) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const monthlyTrend: MonthTrendRow[] = trendMonths.map(({ year: y, month: m }) => {
      const key = `${y}-${m}`;
      const income = monthlyIncome.get(key) ?? 0;
      const expenses = monthlyExpense.get(key) ?? 0;
      return {
        year: y,
        month: m,
        label: monthLabel(locale, y, m),
        income,
        expenses,
        savings: income - expenses,
      };
    });

    const quincenaCompare: QuincenaCompareRow[] = trendMonths.map(
      ({ year: y, month: m }) => {
        const key = `${y}-${m}`;
        const q = quincenaByMonth.get(key) ?? { q1: 0, q2: 0 };
        return {
          year: y,
          month: m,
          label: monthLabel(locale, y, m),
          q1: q.q1,
          q2: q.q2,
        };
      },
    );

    const topExpenses = [...allExpenses]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    const categoryTrends: CategoryTrendRow[] = [...categoryTotals.entries()]
      .filter(([id]) => id !== "unknown")
      .map(([categoryId, current]) => {
        const previous = prevCategoryTotals.get(categoryId) ?? 0;
        const changePercent =
          previous > 0
            ? ((current - previous) / previous) * 100
            : current > 0
              ? 100
              : 0;
        return {
          categoryId,
          name: catName(categoryId),
          color: catColor(categoryId),
          current,
          previous,
          changePercent,
        };
      })
      .filter((r) => r.current > 0 || r.previous > 0)
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

    const netBalance = totalIncome - totalExpenses;
    const savingsRate =
      totalIncome > 0 ? (netBalance / totalIncome) * 100 : 0;

    return {
      data: {
        periodType,
        year,
        month,
        locale,
        totalIncome,
        totalExpenses,
        netBalance,
        savingsRate,
        byCategory,
        monthlyTrend,
        quincenaCompare,
        topExpenses,
        categoryTrends,
      },
      error: null,
    };
  } catch (e) {
    const message = errorMessageFromUnknown(e);
    return { data: null, error: message };
  }
}
