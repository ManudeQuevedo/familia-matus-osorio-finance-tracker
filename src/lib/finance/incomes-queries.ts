import type { SupabaseClient } from "@supabase/supabase-js";

import type { AppLocale } from "@/lib/finance/dashboard-queries";
import { num } from "@/lib/finance/format";
import {
  CAROLINA_EMAIL,
  MANUEL_EMAIL,
  personFromEmail,
  type HouseholdPerson,
} from "@/lib/finance/household";

export type AccountOption = {
  id: string;
  name: string;
};

export type IncomeRow = {
  id: string;
  type: "salary" | "bonus" | "other";
  amount_mxn: number;
  amount_original: number | null;
  original_currency: "MXN" | "USD";
  exchange_rate_used: number | null;
  paycheck_number: 1 | 2 | null;
  received_date: string;
  notes: string | null;
  person: HouseholdPerson;
  personLabel: string;
};

export type PersonMonthSummary = {
  totalMxn: number;
  salaryQ1: number;
  salaryQ2: number;
  bonuses: number;
  usdTotal: number;
  avgExchangeRate: number | null;
};

export type IncomesSnapshot = {
  year: number;
  month: number;
  locale: AppLocale;
  accounts: AccountOption[];
  manuel: PersonMonthSummary;
  carolina: PersonMonthSummary;
  familyTotalMxn: number;
  incomes: IncomeRow[];
  householdProfiles: { id: string; email: string; person: HouseholdPerson }[];
};

function emptySummary(): PersonMonthSummary {
  return {
    totalMxn: 0,
    salaryQ1: 0,
    salaryQ2: 0,
    bonuses: 0,
    usdTotal: 0,
    avgExchangeRate: null,
  };
}

function summarizePerson(
  rows: {
    type: string;
    amount_mxn: unknown;
    amount_original: unknown;
    original_currency: string;
    exchange_rate_used: unknown;
    paycheck_number: number | null;
  }[],
): PersonMonthSummary {
  const summary = emptySummary();
  let rateSum = 0;
  let rateCount = 0;

  for (const r of rows) {
    const mxn = num(r.amount_mxn);
    summary.totalMxn += mxn;
    if (r.type === "bonus") {
      summary.bonuses += mxn;
    } else if (r.paycheck_number === 1) {
      summary.salaryQ1 += mxn;
    } else if (r.paycheck_number === 2) {
      summary.salaryQ2 += mxn;
    } else if (r.type === "salary") {
      summary.salaryQ1 += mxn;
    }

    if (r.original_currency === "USD") {
      const usd = num(r.amount_original);
      summary.usdTotal += usd;
      const rate = num(r.exchange_rate_used);
      if (rate > 0) {
        rateSum += rate;
        rateCount += 1;
      }
    }
  }

  if (rateCount > 0) {
    summary.avgExchangeRate = rateSum / rateCount;
  }
  return summary;
}

export async function fetchIncomesSnapshot(
  supabase: SupabaseClient,
  args: {
    userId: string;
    year: number;
    month: number;
    locale: AppLocale;
  },
): Promise<{ data: IncomesSnapshot | null; error: string | null }> {
  const { userId, year, month, locale } = args;

  try {
    const [accountsRes, profilesRes, incomesRes] = await Promise.all([
      supabase
        .from("accounts")
        .select("id, name")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("name"),
      supabase.from("profiles").select("id, email, full_name"),
      supabase
        .from("incomes")
        .select(
          "id, user_id, type, amount_mxn, amount_original, original_currency, exchange_rate_used, paycheck_number, received_date, notes",
        )
        .eq("period_year", year)
        .eq("period_month", month)
        .order("received_date", { ascending: false }),
    ]);

    if (accountsRes.error) throw accountsRes.error;
    if (profilesRes.error) throw profilesRes.error;
    if (incomesRes.error) throw incomesRes.error;

    const profileById = new Map(
      (profilesRes.data ?? []).map((p) => [
        p.id as string,
        {
          email: p.email as string,
          person: personFromEmail(p.email as string),
          full_name: (p.full_name as string | null) ?? null,
        },
      ]),
    );

    const householdProfiles = (profilesRes.data ?? [])
      .filter((p) => {
        const e = (p.email as string).toLowerCase();
        return e === MANUEL_EMAIL || e === CAROLINA_EMAIL;
      })
      .map((p) => ({
        id: p.id as string,
        email: p.email as string,
        person: personFromEmail(p.email as string),
      }));

    const manuelRows: typeof incomesRes.data = [];
    const carolinaRows: typeof incomesRes.data = [];

    for (const row of incomesRes.data ?? []) {
      const prof = profileById.get(row.user_id as string);
      if (prof?.person === "manuel") manuelRows.push(row);
      else if (prof?.person === "carolina") carolinaRows.push(row);
    }

    const manuel = summarizePerson(manuelRows);
    const carolina = summarizePerson(carolinaRows);

    const personLabel = (person: HouseholdPerson) => {
      if (locale === "es") {
        if (person === "manuel") return "Manuel";
        if (person === "carolina") return "Carolina";
      } else {
        if (person === "manuel") return "Manuel";
        if (person === "carolina") return "Carolina";
      }
      return "—";
    };

    const incomes: IncomeRow[] = (incomesRes.data ?? []).map((r) => {
      const prof = profileById.get(r.user_id as string);
      const person = prof?.person ?? "unknown";
      return {
        id: r.id as string,
        type: r.type as IncomeRow["type"],
        amount_mxn: num(r.amount_mxn),
        amount_original:
          r.amount_original != null ? num(r.amount_original) : null,
        original_currency: r.original_currency as "MXN" | "USD",
        exchange_rate_used:
          r.exchange_rate_used != null ? num(r.exchange_rate_used) : null,
        paycheck_number: (r.paycheck_number as 1 | 2 | null) ?? null,
        received_date: r.received_date as string,
        notes: (r.notes as string | null) ?? null,
        person,
        personLabel: personLabel(person),
      };
    });

    return {
      data: {
        year,
        month,
        locale,
        accounts: (accountsRes.data ?? []).map((a) => ({
          id: a.id as string,
          name: a.name as string,
        })),
        manuel,
        carolina,
        familyTotalMxn: manuel.totalMxn + carolina.totalMxn,
        incomes,
        householdProfiles,
      },
      error: null,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { data: null, error: message };
  }
}
