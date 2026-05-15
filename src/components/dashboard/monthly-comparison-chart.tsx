"use client";

import { BarChart2, ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import type {
  MonthlyComparisonChartRow,
  MonthlyComparisonData,
} from "@/lib/finance/monthly-comparison-queries";
import { cn } from "@/lib/utils";

type ChartDatum = {
  month: string;
  monthKey: string;
  income: number;
  total: number;
  [key: string]: string | number;
};

type RechartsTooltipPayload = {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string;
};

type RangeMonths = 3 | 6 | 12;
type ViewMode = "expenses" | "compare";

function buildChartData(
  rows: MonthlyComparisonChartRow[],
  categoryIds: string[],
): ChartDatum[] {
  return rows.map((r) => {
    const row: ChartDatum = {
      month: r.month,
      monthKey: r.monthKey,
      income: r.income,
      total: 0,
    };
    let sum = 0;
    for (const id of categoryIds) {
      const v = r.amountsByCategory[id] ?? 0;
      row[id] = v;
      sum += v;
    }
    row.total = sum;
    return row;
  });
}

function MonthlyComparisonTooltip({
  active,
  payload,
  label,
  viewMode,
  locale,
  formatIncomeLabel,
  totalExpensesLabel,
}: {
  active?: boolean;
  payload?: RechartsTooltipPayload[];
  label?: string | number;
  viewMode: ViewMode;
  locale: string;
  formatIncomeLabel: string;
  totalExpensesLabel: string;
}) {
  if (!active || !payload?.length) return null;

  const incomeEntry = payload.find(
    (p: RechartsTooltipPayload) => p.dataKey === "income",
  );
  const expenses = payload.filter(
    (p: RechartsTooltipPayload) =>
      p.dataKey !== "income" &&
      p.dataKey !== "month" &&
      p.dataKey !== "monthKey" &&
      p.dataKey !== "total",
  );

  const totalExpenses = expenses.reduce(
    (s: number, p: RechartsTooltipPayload) =>
      s + (typeof p.value === "number" ? p.value : Number(p.value) || 0),
    0,
  );

  const fmt = new Intl.NumberFormat(locale === "es" ? "es-MX" : "en-US", {
    maximumFractionDigits: 0,
  });

  const expenseRows = expenses
    .filter((p: RechartsTooltipPayload) => Number(p.value) > 0)
    .sort(
      (a: RechartsTooltipPayload, b: RechartsTooltipPayload) =>
        (typeof b.value === "number" ? b.value : Number(b.value)) -
        (typeof a.value === "number" ? a.value : Number(a.value)),
    );

  return (
    <div
      style={{
        background: "var(--bg-modal)",
        border: "1px solid var(--border-default)",
        borderRadius: "10px",
        padding: "12px 16px",
        boxShadow: "var(--shadow-md)",
        minWidth: "200px",
      }}>
      <p
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "var(--text-primary)",
          marginBottom: 8,
        }}>
        {label}
      </p>

      {viewMode === "compare" && incomeEntry != null ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
            paddingBottom: 8,
            borderBottom: "1px solid var(--border-subtle)",
          }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {formatIncomeLabel}
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "hsl(var(--accent))",
            }}>
            ${fmt.format(Number(incomeEntry.value))}
          </span>
        </div>
      ) : null}

      {expenseRows.map((p: RechartsTooltipPayload) => (
        <div
          key={String(p.dataKey)}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 4,
          }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: typeof p.color === "string" ? p.color : "#94a3b8",
              }}
            />
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {typeof p.name === "string" && p.name.trim()
                ? p.name
                : String(p.dataKey)}
            </span>
          </div>
          <span
            style={{
              fontSize: 12,
              color: "var(--text-primary)",
            }}>
            ${fmt.format(Number(p.value))}
          </span>
        </div>
      ))}

      <div
        style={{
          borderTop: "1px solid var(--border-subtle)",
          marginTop: 8,
          paddingTop: 8,
          display: "flex",
          justifyContent: "space-between",
        }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--text-secondary)",
          }}>
          {totalExpensesLabel}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-primary)",
          }}>
          ${fmt.format(totalExpenses)}
        </span>
      </div>
    </div>
  );
}

export function MonthlyComparisonChart({
  data,
  loadError,
}: {
  data: MonthlyComparisonData | null;
  loadError?: string | null;
}) {
  const t = useTranslations("Finance.dashboard.monthlyChart");
  const intlLocale = useLocale();
  const desktop = useIsDesktop();

  const [rangeMonths, setRangeMonths] = useState<RangeMonths>(6);
  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("compare");
  const [legendCategoryHidden, setLegendCategoryHidden] = useState<Set<string>>(
    () => new Set(),
  );
  const [legendIncomeHidden, setLegendIncomeHidden] = useState(false);

  const baseCategories = useMemo(() => data?.categories ?? [], [data]);
  const baseRows = useMemo(() => data?.rows ?? [], [data]);

  const monthsWithExpenseData = useMemo(
    () => baseRows.filter((r) => r.total > 0).length,
    [baseRows],
  );

  const activeCategoryList = useMemo(() => {
    if (!selectedIds || selectedIds.size === 0) return baseCategories;
    return baseCategories.filter((c) => selectedIds.has(c.id));
  }, [baseCategories, selectedIds]);

  const slicedRows = useMemo(() => {
    return baseRows.slice(-rangeMonths);
  }, [baseRows, rangeMonths]);

  const barCategories = useMemo(
    () => activeCategoryList.filter((c) => !legendCategoryHidden.has(c.id)),
    [activeCategoryList, legendCategoryHidden],
  );

  const categoryIdsForChart = useMemo(
    () => barCategories.map((c) => c.id),
    [barCategories],
  );

  const chartData = useMemo(
    () => buildChartData(slicedRows, categoryIdsForChart),
    [slicedRows, categoryIdsForChart],
  );

  const showIncomeLine = viewMode === "compare" && !legendIncomeHidden;

  const toggleCategory = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const allIds = baseCategories.map((c) => c.id);
      if (prev === null) {
        if (!checked) {
          const next = new Set(allIds);
          next.delete(id);
          return next.size === 0 ? new Set(allIds) : next;
        }
        return null;
      }
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      if (next.size === allIds.length) return null;
      if (next.size === 0) return new Set(allIds);
      return next;
    });
  };

  const selectAllCategories = () => setSelectedIds(null);

  const categoryTriggerLabel =
    selectedIds === null
      ? t("categoriesAll")
      : t("categoriesCount", { count: selectedIds.size });

  const toggleLegendCategory = (id: string) => {
    setLegendCategoryHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loadError) {
    return (
      <section className="mt-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-xl border px-6 py-14 text-center"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--border-default)",
          }}>
          <BarChart2 className="h-10 w-10 text-muted-foreground opacity-60" />
          <p className="max-w-sm text-sm text-muted-foreground">
            {t("loadError")}
          </p>
        </div>
      </section>
    );
  }

  if (!data || monthsWithExpenseData < 2) {
    return (
      <section className="mt-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-xl border px-6 py-14 text-center"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--border-default)",
          }}>
          <BarChart2 className="h-10 w-10 text-muted-foreground opacity-60" />
          <p className="max-w-sm text-sm text-muted-foreground">
            {t("emptyNotEnoughMonths")}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
          <div className="inline-flex rounded-lg border border-border-default bg-bg-card-nested p-0.5 dark:border-border-default">
            {([3, 6, 12] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRangeMonths(n)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition",
                  rangeMonths === n
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-text-secondary hover:text-text-primary dark:text-text-muted",
                )}>
                {t(`rangeMonths.${n}` as "rangeMonths.3")}
              </button>
            ))}
          </div>

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="justify-between gap-2 border-border-default">
                <span className="truncate">{categoryTriggerLabel}</span>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="max-h-72 w-56 overflow-y-auto">
              <DropdownMenuLabel>{t("categoriesLabel")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={selectedIds === null}
                onCheckedChange={(c) => {
                  if (c) selectAllCategories();
                }}
                onSelect={(e) => e.preventDefault()}>
                {t("categoriesAll")}
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {baseCategories.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={selectedIds === null ? true : selectedIds.has(c.id)}
                  onCheckedChange={(checked) =>
                    toggleCategory(c.id, Boolean(checked))
                  }
                  onSelect={(e) => e.preventDefault()}>
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    {c.name}
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="inline-flex rounded-lg border border-border-default bg-bg-card-nested p-0.5 dark:border-border-default">
            <button
              type="button"
              onClick={() => setViewMode("expenses")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition",
                viewMode === "expenses"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-text-secondary hover:text-text-primary dark:text-text-muted",
              )}>
              {t("viewExpenses")}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("compare")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition",
                viewMode === "compare"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-text-secondary hover:text-text-primary dark:text-text-muted",
              )}>
              {t("viewCompare")}
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          padding: "1.5rem",
        }}>
        <div
          className={cn("w-full min-w-0", desktop ? "h-[320px]" : "h-[240px]")}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: desktop ? 0 : 4 }}>
              <CartesianGrid
                strokeDasharray="4 4"
                stroke="var(--border-subtle)"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{
                  fontSize: desktop ? 12 : 10,
                  fill: "var(--text-muted)",
                }}
                axisLine={false}
                tickLine={false}
                interval={desktop ? 0 : "preserveStartEnd"}
                angle={desktop ? 0 : -32}
                textAnchor={desktop ? "middle" : "end"}
                height={desktop ? undefined : 48}
              />
              <YAxis
                tickFormatter={(v) => `$${(Number(v) / 1000).toFixed(0)}k`}
                tick={{ fontSize: 12, fill: "var(--text-muted)" }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                content={(props) => (
                  <MonthlyComparisonTooltip
                    active={props.active}
                    payload={
                      props.payload as unknown as
                        | RechartsTooltipPayload[]
                        | undefined
                    }
                    label={props.label}
                    viewMode={viewMode}
                    locale={intlLocale}
                    formatIncomeLabel={t("tooltipIncome")}
                    totalExpensesLabel={t("tooltipTotalExpenses")}
                  />
                )}
              />

              {barCategories.map((cat, idx) => (
                <Bar
                  key={cat.id}
                  name={cat.name}
                  dataKey={cat.id}
                  stackId="expenses"
                  fill={cat.color}
                  radius={
                    idx === barCategories.length - 1
                      ? [4, 4, 0, 0]
                      : [0, 0, 0, 0]
                  }
                />
              ))}

              {showIncomeLine ? (
                <Line
                  type="monotone"
                  dataKey="income"
                  name={t("legendIncome")}
                  stroke="hsl(var(--accent))"
                  strokeWidth={2.5}
                  dot={{ fill: "hsl(var(--accent))", r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <ul
          className="mt-4 flex list-none flex-wrap gap-x-4 gap-y-2 p-0"
          aria-label={t("categoriesLabel")}>
          {activeCategoryList.map((c) => {
            const dimmed = legendCategoryHidden.has(c.id);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => toggleLegendCategory(c.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md px-1 py-0.5 text-left transition",
                    dimmed ? "opacity-40" : "opacity-100",
                  )}
                  aria-pressed={!dimmed}>
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="text-xs text-text-secondary">{c.name}</span>
                </button>
              </li>
            );
          })}
          {viewMode === "compare" ? (
            <li>
              <button
                type="button"
                onClick={() => setLegendIncomeHidden((h) => !h)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-1 py-0.5 text-left transition",
                  legendIncomeHidden ? "opacity-40" : "opacity-100",
                )}
                aria-pressed={!legendIncomeHidden}>
                <span
                  className="h-0.5 w-5 shrink-0 rounded-full"
                  style={{ backgroundColor: "hsl(var(--accent))" }}
                />
                <span className="text-xs text-text-secondary">
                  {t("legendIncome")}
                </span>
              </button>
            </li>
          ) : null}
        </ul>
      </div>
    </section>
  );
}
