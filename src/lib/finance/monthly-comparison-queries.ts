import type { SupabaseClient } from "@supabase/supabase-js";

import type { AppLocale } from "@/lib/finance/dashboard-queries";
import { getFamilyIdForUser } from "@/lib/supabase/family";

export type MonthlyComparisonCategory = {
  id: string;
  name: string;
  color: string;
};

export type MonthlyComparisonChartRow = {
  monthKey: string;
  month: string;
  income: number;
  total: number;
  /** amounts keyed by category id */
  amountsByCategory: Record<string, number>;
};

export type MonthlyComparisonData = {
  rows: MonthlyComparisonChartRow[];
  categories: MonthlyComparisonCategory[];
};

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number.parseFloat(v) || 0;
  return 0;
}

/** Last `count` calendar months ending at `ref`, oldest first. */
export function getRecentMonthPeriods(ref: Date, count: number) {
  const periods: { year: number; month: number }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    periods.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return periods;
}

function periodKey(y: number, m: number) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

function formatMonthShort(locale: AppLocale, y: number, m: number) {
  return new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    month: "short",
    year: "2-digit",
  }).format(new Date(y, m - 1, 1));
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export async function fetchMonthlyComparisonData(
  supabase: SupabaseClient,
  args: { userId: string; locale: AppLocale },
): Promise<{ data: MonthlyComparisonData | null; error: string | null }> {
  const { userId, locale } = args;
  const now = new Date();
  const periods = getRecentMonthPeriods(now, 12);
  const first = periods[0]!;
  const last = periods[periods.length - 1]!;
  const startDate = `${first.year}-${pad2(first.month)}-01`;
  const lastDayLast = new Date(last.year, last.month, 0).getDate();
  const endDate = `${last.year}-${pad2(last.month)}-${pad2(lastDayLast)}`;

  const periodSet = new Set(periods.map((p) => periodKey(p.year, p.month)));

  try {
    const familyId = await getFamilyIdForUser(supabase, userId);
    if (!familyId) {
      return { data: null, error: "family_not_configured" };
    }

    const [expenseRes, variableRes, incomesRes, categoriesRes] =
      await Promise.all([
        supabase
          .from("expense_records")
          .select(
            `
            amount,
            period_year,
            period_month,
            subcategories (
              category_id,
              categories ( name_es, name_en, color )
            )
          `,
          )
          .eq("family_id", familyId)
          .gte("period_year", first.year)
          .lte("period_year", last.year),
        supabase
          .from("variable_expenses")
          .select("amount, date, category_id")
          .eq("family_id", familyId)
          .gte("date", startDate)
          .lte("date", endDate),
        supabase
          .from("incomes")
          .select("amount_mxn, period_year, period_month")
          .eq("family_id", familyId)
          .gte("period_year", first.year)
          .lte("period_year", last.year),
        supabase
          .from("categories")
          .select("id, name_es, name_en, color")
          .in("type", ["expense", "both"]),
      ]);

    if (expenseRes.error) throw expenseRes.error;
    if (variableRes.error) throw variableRes.error;
    if (incomesRes.error) throw incomesRes.error;
    if (categoriesRes.error) throw categoriesRes.error;

    const catRows = categoriesRes.data ?? [];
    const catById = new Map(
      catRows.map((c) => [
        c.id as string,
        {
          name: locale === "es" ? c.name_es : c.name_en,
          color: (c.color as string) ?? "#64748b",
        },
      ]),
    );


    const spendByPeriod = new Map<string, Map<string, number>>();

    function addSpend(key: string, categoryId: string, amount: number) {
      let inner = spendByPeriod.get(key);
      if (!inner) {
        inner = new Map();
        spendByPeriod.set(key, inner);
      }
      inner.set(categoryId, (inner.get(categoryId) ?? 0) + amount);
    }

    for (const row of expenseRes.data ?? []) {
      const y = Number(row.period_year);
      const m = Number(row.period_month);
      const pk = periodKey(y, m);
      if (!periodSet.has(pk)) continue;

      const rawSub = row.subcategories as unknown;
      const sub = Array.isArray(rawSub) ? rawSub[0] : rawSub;
      const subObj = sub as {
        category_id?: string;
        categories?: {
          name_es?: string;
          name_en?: string;
          color?: string;
        } | null;
      } | null;

      const categoryId = subObj?.category_id as string | undefined;
      if (!categoryId) continue;

      if (!catById.has(categoryId) && subObj?.categories) {
        const c = subObj.categories;
        catById.set(categoryId, {
          name: locale === "es" ? (c.name_es ?? "") : (c.name_en ?? ""),
          color: c.color ?? "#64748b",
        });
      }

      addSpend(pk, categoryId, num(row.amount));
    }

    for (const row of variableRes.data ?? []) {
      const d = row.date as string;
      const parts = d.slice(0, 10).split("-").map(Number);
      const y = parts[0]!;
      const mo = parts[1]!;
      const pk = periodKey(y, mo);
      if (!periodSet.has(pk)) continue;
      const categoryId = row.category_id as string;
      addSpend(pk, categoryId, num(row.amount));
    }

    const incomeByPeriod = new Map<string, number>();
    for (const row of incomesRes.data ?? []) {
      const y = Number(row.period_year);
      const m = Number(row.period_month);
      const pk = periodKey(y, m);
      if (!periodSet.has(pk)) continue;
      incomeByPeriod.set(pk, (incomeByPeriod.get(pk) ?? 0) + num(row.amount_mxn));
    }

    const seenCatIds = new Set<string>();
    for (const m of spendByPeriod.values()) {
      for (const id of m.keys()) seenCatIds.add(id);
    }

    const categoryTotals = new Map<string, number>();
    for (const id of seenCatIds) {
      let s = 0;
      for (const pk of periodSet) {
        s += spendByPeriod.get(pk)?.get(id) ?? 0;
      }
      categoryTotals.set(id, s);
    }

    const categoriesSorted: MonthlyComparisonCategory[] = [...seenCatIds]
      .map((id) => {
        const meta = catById.get(id);
        return {
          id,
          name: meta?.name?.trim() ? meta.name : "—",
          color: meta?.color ?? "#64748b",
        };
      })
      .sort((a, b) => {
        const da = categoryTotals.get(a.id) ?? 0;
        const db = categoryTotals.get(b.id) ?? 0;
        if (db !== da) return db - da;
        return a.name.localeCompare(b.name);
      });

    const rows: MonthlyComparisonChartRow[] = periods.map((p) => {
      const pk = periodKey(p.year, p.month);
      const inner = spendByPeriod.get(pk);
      const amountsByCategory: Record<string, number> = {};
      let total = 0;
      if (inner) {
        for (const [cid, amt] of inner) {
          amountsByCategory[cid] = amt;
          total += amt;
        }
      }
      return {
        monthKey: pk,
        month: formatMonthShort(locale, p.year, p.month),
        income: incomeByPeriod.get(pk) ?? 0,
        total,
        amountsByCategory,
      };
    });

    return {
      data: { rows, categories: categoriesSorted },
      error: null,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { data: null, error: message };
  }
}
