import type { AiPageContext } from "@/lib/ai/financial-context";

export function buildPageContextFromPath(
  pathWithoutLocale: string,
  locale: string,
  options?: { focusedGoalId?: string },
): AiPageContext {
  const now = new Date();
  const monthLabel = new Intl.DateTimeFormat(
    locale === "es" ? "es-MX" : "en-US",
    { month: "long", year: "numeric" },
  ).format(now);

  const base: AiPageContext = {};

  if (pathWithoutLocale.startsWith("/expenses")) {
    return {
      currentPage: "expenses",
      currentMonth: monthLabel,
    };
  }
  if (pathWithoutLocale.startsWith("/goals")) {
    return {
      currentPage: "goals",
      ...(options?.focusedGoalId
        ? { focusedGoal: options.focusedGoalId }
        : {}),
    };
  }
  if (pathWithoutLocale.startsWith("/debts")) {
    return { currentPage: "debts" };
  }
  if (pathWithoutLocale.startsWith("/incomes")) {
    return { currentPage: "incomes", currentMonth: monthLabel };
  }
  if (pathWithoutLocale.startsWith("/reports")) {
    return { currentPage: "reports", currentMonth: monthLabel };
  }
  if (pathWithoutLocale.startsWith("/dashboard") || pathWithoutLocale === "/") {
    return { currentPage: "dashboard", currentMonth: monthLabel };
  }

  return base;
}
