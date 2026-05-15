"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { FinancePageShell } from "@/components/finance/FinancePageShell";
import { useAccentChartColors } from "@/hooks/use-accent-chart-colors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMxn, formatShortDate } from "@/lib/finance/format";
import type {
  ReportPeriodType,
  ReportsSnapshot,
} from "@/lib/finance/reports-queries";
import { cn } from "@/lib/utils";

const CHART_ANIM = { duration: 0.8, ease: "easeOut" as const };

export function ReportsPageClient({
  year: initialYear,
  month: initialMonth,
  initialData,
  loadError,
}: {
  year: number;
  month: number;
  initialData: ReportsSnapshot | null;
  loadError: string | null;
}) {
  const t = useTranslations("Finance.reports");
  const tc = useTranslations("Finance.common");
  const intlLocale = useLocale();
  const chartColors = useAccentChartColors();

  const [periodType, setPeriodType] = useState<ReportPeriodType>("monthly");
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [quarter, setQuarter] = useState(
    Math.floor((initialMonth - 1) / 3) + 1,
  );

  const anchorMonth =
    periodType === "quarterly" ? (quarter - 1) * 3 + 1 : month;

  const { data, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["finance-reports", periodType, year, anchorMonth, intlLocale],
    queryFn: async () => {
      const qs = new URLSearchParams({
        periodType,
        year: String(year),
        month: String(anchorMonth),
        locale: intlLocale,
      });
      const res = await fetch(`/api/finance/reports?${qs}`);
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<ReportsSnapshot>;
    },
    initialData:
      periodType === "monthly" &&
      year === initialYear &&
      anchorMonth === initialMonth
        ? (initialData ?? undefined)
        : undefined,
    enabled: Boolean(initialData),
  });

  const snapshot = data ?? initialData;

  const categoryChartData = useMemo(
    () =>
      snapshot?.byCategory.map((c) => ({
        name: c.name,
        amount: c.amount,
        fill: c.color,
        percent: c.percentOfIncome,
      })) ?? [],
    [snapshot],
  );

  const trendChartData = useMemo(
    () =>
      snapshot?.monthlyTrend.map((m) => ({
        name: m.label,
        income: m.income,
        expenses: m.expenses,
        savings: m.savings,
      })) ?? [],
    [snapshot],
  );

  const quincenaData = useMemo(
    () =>
      snapshot?.quincenaCompare.map((q) => ({
        name: q.label,
        q1: q.q1,
        q2: q.q2,
      })) ?? [],
    [snapshot],
  );

  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const yearOptions = Array.from({ length: 6 }, (_, i) => initialYear - 3 + i);

  if (loadError || !initialData) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mx-auto max-w-2xl px-4 py-10 text-center">
        <p className="text-sm text-red-600">{loadError ?? tc("error")}</p>
        <Button className="mt-4" variant="outline" onClick={() => refetch()}>
          {tc("retry")}
        </Button>
      </motion.div>
    );
  }

  if (isError) {
    return (
      <div className="px-4 py-10 text-center text-sm text-red-600">
        {(error as Error)?.message}
      </div>
    );
  }

  if (!snapshot) return null;

  return (
    <FinancePageShell>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{t("title")}</h1>
          </div>
          <motion.div layout className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">{t("filters.periodType")}</Label>
              <Select
                value={periodType}
                onValueChange={(v) => setPeriodType(v as ReportPeriodType)}>
                <SelectTrigger className="mt-1 w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">
                    {t("filters.monthly")}
                  </SelectItem>
                  <SelectItem value="quarterly">
                    {t("filters.quarterly")}
                  </SelectItem>
                  <SelectItem value="annual">{t("filters.annual")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {periodType === "monthly" && (
              <div>
                <Label className="text-xs">{t("filters.month")}</Label>
                <Select
                  value={String(month)}
                  onValueChange={(v) => setMonth(Number(v))}>
                  <SelectTrigger className="mt-1 w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {new Date(2000, m - 1, 1).toLocaleString(
                          intlLocale === "es" ? "es-MX" : "en-US",
                          { month: "long" },
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {periodType === "quarterly" && (
              <div>
                <Label className="text-xs">{t("filters.quarter")}</Label>
                <Select
                  value={String(quarter)}
                  onValueChange={(v) => setQuarter(Number(v))}>
                  <SelectTrigger className="mt-1 w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((q) => (
                      <SelectItem key={q} value={String(q)}>
                        Q{q}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">{t("filters.year")}</Label>
              <Select
                value={String(year)}
                onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="mt-1 w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </motion.div>
        </header>

        {isFetching && !data ? (
          <Skeleton className="mb-6 h-28 w-full" />
        ) : (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8">
            <h2 className="mb-3 text-lg font-semibold">
              {t("executive.title")}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  {
                    key: "income",
                    value: snapshot.totalIncome,
                    tone: "neutral",
                  },
                  {
                    key: "expenses",
                    value: snapshot.totalExpenses,
                    tone: "neutral",
                  },
                  {
                    key: "balance",
                    value: snapshot.netBalance,
                    tone: snapshot.netBalance >= 0 ? "good" : "bad",
                  },
                  {
                    key: "savingsRate",
                    value: snapshot.savingsRate,
                    tone: "neutral",
                    isPercent: true,
                  },
                ] as const
              ).map((card, i) => (
                <motion.div
                  key={card.key}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-text-muted">
                        {t(`executive.${card.key}`)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p
                        className={cn(
                          "text-xl font-semibold tabular-nums",
                          card.tone === "good" && "text-accent",
                          card.tone === "bad" &&
                            "text-red-600 dark:text-red-400",
                        )}>
                        {"isPercent" in card && card.isPercent
                          ? `${card.value.toFixed(1)}%`
                          : formatMxn(intlLocale, card.value)}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        <motion.section
          layout
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">
            {t("byCategory.title")}
          </h2>
          {categoryChartData.length === 0 ? (
            <p className="text-sm text-text-muted">{t("byCategory.empty")}</p>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={categoryChartData}
                      layout="vertical"
                      margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => formatMxn(intlLocale, v)}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={100}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(v) => formatMxn(intlLocale, Number(v ?? 0))}
                      />
                      <Bar
                        dataKey="amount"
                        radius={[0, 4, 4, 0]}
                        animationDuration={CHART_ANIM.duration}>
                        {categoryChartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </motion.div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-text-muted">
                        <th className="py-2">{t("byCategory.title")}</th>
                        <th className="py-2 text-right">MXN</th>
                        <th className="py-2 text-right">
                          {t("byCategory.percentIncome")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.byCategory.map((row) => (
                        <tr
                          key={row.categoryId}
                          className="border-b border-border-subtle dark:border-border-default">
                          <td className="py-2">
                            <span
                              className="mr-2 inline-block h-2 w-2 rounded-full"
                              style={{ backgroundColor: row.color }}
                            />
                            {row.name}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {formatMxn(intlLocale, row.amount)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {row.percentOfIncome.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.section>

        <motion.section
          layout
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">{t("trend.title")}</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendChartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => formatMxn(intlLocale, v)} />
                    <Tooltip
                      formatter={(v) => formatMxn(intlLocale, Number(v ?? 0))}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="savings"
                      fill={chartColors.muted}
                      stroke="none"
                      name={t("trend.savings")}
                    />
                    <Line
                      type="monotone"
                      dataKey="income"
                      stroke={chartColors.main}
                      strokeWidth={2}
                      dot={false}
                      name={t("trend.income")}
                      animationDuration={CHART_ANIM.duration}
                    />
                    <Line
                      type="monotone"
                      dataKey="expenses"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={false}
                      name={t("trend.expenses")}
                      animationDuration={CHART_ANIM.duration}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        <motion.section
          layout
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">{t("quincena.title")}</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={quincenaData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => formatMxn(intlLocale, v)} />
                    <Tooltip
                      formatter={(v) => formatMxn(intlLocale, Number(v ?? 0))}
                    />
                    <Legend />
                    <Bar
                      dataKey="q1"
                      stackId="a"
                      fill="#6366f1"
                      name={t("quincena.q1")}
                      animationDuration={CHART_ANIM.duration}
                    />
                    <Bar
                      dataKey="q2"
                      stackId="a"
                      fill={chartColors.main}
                      name={t("quincena.q2")}
                      animationDuration={CHART_ANIM.duration}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        <motion.section
          layout
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">{t("top.title")}</h2>
          {snapshot.topExpenses.length === 0 ? (
            <p className="text-sm text-text-muted">{t("top.empty")}</p>
          ) : (
            <ul className="space-y-2">
              {snapshot.topExpenses.map((item, i) => (
                <motion.li
                  key={`${item.kind}-${item.id}`}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center justify-between rounded-xl border border-border-default bg-bg-card px-4 py-3 dark:border-border-default bg-bg-card">
                  <motion.div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-text-muted">
                      {item.categoryName} ·{" "}
                      {formatShortDate(intlLocale, item.date)}
                    </p>
                  </motion.div>
                  <span className="font-semibold tabular-nums">
                    {formatMxn(intlLocale, item.amount)}
                  </span>
                </motion.li>
              ))}
            </ul>
          )}
        </motion.section>

        <motion.section
          layout
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}>
          <h2 className="mb-3 text-lg font-semibold">{t("trends.title")}</h2>
          {snapshot.categoryTrends.length === 0 ? (
            <p className="text-sm text-text-muted">{t("trends.empty")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {snapshot.categoryTrends.slice(0, 12).map((row) => {
                const up = row.changePercent > 0;
                const down = row.changePercent < 0;
                return (
                  <Badge
                    key={row.categoryId}
                    variant={up ? "destructive" : down ? "default" : "outline"}
                    className={cn(down && "bg-primary hover:bg-accent-hover")}>
                    {up ? "↑ " : down ? "↓ " : ""}
                    {row.name}{" "}
                    {up
                      ? t("trends.up", {
                          percent: Math.abs(row.changePercent).toFixed(0),
                        })
                      : down
                        ? t("trends.down", {
                            percent: Math.abs(row.changePercent).toFixed(0),
                          })
                        : "0%"}
                  </Badge>
                );
              })}
            </div>
          )}
        </motion.section>
      </motion.div>
    </FinancePageShell>
  );
}
