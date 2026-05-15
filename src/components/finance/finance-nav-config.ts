export type FinanceNavKey =
  | "dashboard"
  | "expenses"
  | "incomes"
  | "goals"
  | "debts"
  | "reports"
  | "ai"
  | "notes"
  | "more";

export const FINANCE_PATH_BY_KEY: Record<FinanceNavKey, string> = {
  dashboard: "/dashboard",
  expenses: "/expenses",
  incomes: "/incomes",
  goals: "/goals",
  debts: "/debts",
  reports: "/reports",
  ai: "/ai",
  notes: "/notes",
  more: "/more",
};
