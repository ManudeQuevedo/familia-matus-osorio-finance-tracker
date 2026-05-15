"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { animate, motion } from "framer-motion";
import { Bell, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { markExpenseRecordPaid } from "@/lib/finance/actions";
import { notify } from "@/lib/toast";
import { DashboardCategoryChart } from "@/features/finance/dashboard/DashboardCategoryChart";
import { GoalProgressBar } from "@/features/finance/dashboard/GoalProgressBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import type { DashboardSnapshot } from "@/lib/finance/dashboard-queries";
import type { TodayReminder } from "@/lib/finance/notes-queries";
import { uiQuincenaToDbPeriod } from "@/lib/finance/dashboard-queries";
import { getDisplayName } from "@/lib/finance/display-name";
import { cn } from "@/lib/utils";
import { FinanceContentHeaderActions } from "@/components/finance/FinanceContentHeaderActions";
import { CreatorBadge } from "@/components/finance/CreatorBadge";
import { FinancePageShell } from "@/components/finance/FinancePageShell";

function formatMxn(locale: string, value: number) {
  return new Intl.NumberFormat(locale === "es" ? "es-MX" : "en-US", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatLongDate(locale: string, d: Date) {
  return new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function formatMonthYear(locale: string, year: number, month: number) {
  return new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function monthsRemaining(targetIso: string, from = new Date()) {
  const t = new Date(targetIso);
  let m =
    (t.getFullYear() - from.getFullYear()) * 12 +
    (t.getMonth() - from.getMonth());
  if (t.getDate() < from.getDate()) m -= 1;
  return Math.max(0, m);
}

function nextDueDate(dueDay: number, from = new Date()) {
  const y = from.getFullYear();
  const mo = from.getMonth();
  let d = new Date(y, mo, dueDay);
  if (d <= from) {
    d = new Date(y, mo + 1, dueDay);
  }
  return d;
}

function CountUpNumber({
  value,
  locale,
  className,
}: {
  value: number;
  locale: string;
  className?: string;
}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const c = animate(0, value, {
      duration: 0.85,
      ease: "easeOut",
      onUpdate: setN,
    });
    return () => c.stop();
  }, [value]);
  return (
    <span className={className}>
      {formatMxn(locale, Math.round(n * 100) / 100)}
    </span>
  );
}

function CountUpPercent({
  value,
  locale,
  className,
}: {
  value: number;
  locale: string;
  className?: string;
}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const c = animate(0, value, {
      duration: 0.85,
      ease: "easeOut",
      onUpdate: setN,
    });
    return () => c.stop();
  }, [value]);
  const fmt = new Intl.NumberFormat(locale === "es" ? "es-MX" : "en-US", {
    maximumFractionDigits: 1,
  });
  return <span className={className}>{fmt.format(n)}%</span>;
}

export function DashboardHome({
  locale,
  year,
  month,
  initialData,
  loadError,
  userEmail,
}: {
  locale: string;
  year: number;
  month: number;
  initialData: DashboardSnapshot | null;
  loadError: string | null;
  userEmail?: string;
}) {
  const t = useTranslations("Finance.dashboard");
  const tNav = useTranslations("Finance.nav");
  const intlLocale = useLocale();
  const queryClient = useQueryClient();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const { data: todayReminders = [] } = useQuery({
    queryKey: ["finance-notes-reminders-today"],
    queryFn: async () => {
      const res = await fetch("/api/finance/notes?todayReminders=1");
      if (!res.ok) return [];
      const json = (await res.json()) as { reminders: TodayReminder[] };
      return json.reminders ?? [];
    },
  });

  const { data, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["finance-dashboard", year, month, intlLocale],
    queryFn: async () => {
      const qs = new URLSearchParams({
        year: String(year),
        month: String(month),
        locale: intlLocale,
      });
      const res = await fetch(`/api/finance/dashboard?${qs.toString()}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Request failed");
      }
      return res.json() as Promise<DashboardSnapshot>;
    },
    initialData: initialData ?? undefined,
    enabled: Boolean(initialData),
  });

  const snapshot = data ?? initialData;
  const [quincena, setQuincena] = useState<1 | 2>(1);
  const [payingId, setPayingId] = useState<string | null>(null);

  const totalExpenses = snapshot
    ? snapshot.monthlyVariableExpense + snapshot.monthlyRecurringExpense
    : 0;
  const balance = snapshot ? snapshot.monthlyIncome - totalExpenses : 0;
  const savingsRate =
    snapshot && snapshot.monthlyIncome > 0
      ? ((snapshot.monthlyIncome - totalExpenses) / snapshot.monthlyIncome) *
        100
      : 0;

  const dbPeriod = uiQuincenaToDbPeriod(quincena);
  const filteredPaycheck = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.paycheckRecords.filter(
      (r) => r.paycheck_period === dbPeriod,
    );
  }, [snapshot, dbPeriod]);

  const paycheckTotal = filteredPaycheck.reduce((s, r) => s + r.amount, 0);

  const debtTotal = snapshot
    ? snapshot.debts.reduce((s, d) => s + d.current_balance, 0)
    : 0;

  const nextDebt = useMemo(() => {
    if (!snapshot?.debts.length) return null;
    const now = new Date();
    let best: { id: string; name: string; when: Date; monthly: number } | null =
      null;
    for (const d of snapshot.debts) {
      const when = nextDueDate(d.due_day, now);
      if (!best || when < best.when) {
        best = {
          id: d.id,
          name: d.name,
          when,
          monthly: d.monthly_payment,
        };
      }
    }
    return best;
  }, [snapshot]);

  const greetingKey = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "greetingMorning";
    if (h < 19) return "greetingAfternoon";
    return "greetingEvening";
  }, []);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] });
  }, [queryClient]);

  const onMarkPaid = async (id: string, name: string) => {
    setPayingId(id);
    const res = await markExpenseRecordPaid(id, locale);
    setPayingId(null);
    if (res.ok) {
      notify.expenses.markPaidSuccess(name);
      invalidate();
    } else {
      notify.expenses.markPaidError();
    }
  };

  const donutData =
    snapshot?.categorySlices.map((c) => ({
      name: c.name,
      value: c.amount,
      color: c.color,
    })) ?? [];

  const displayName = getDisplayName(
    snapshot?.profile.full_name,
    userEmail,
    t("fallbackName"),
  );

  if (loadError || !initialData) {
    return (
      <FinancePageShell className="flex flex-col items-center justify-center py-10">
        <p className="text-center text-sm text-red-600 dark:text-red-400">
          {loadError ?? t("empty")}
        </p>
        <div className="mt-6 flex justify-center">
          <Button type="button" variant="outline" onClick={() => refetch()}>
            {t("retry")}
          </Button>
        </div>
      </FinancePageShell>
    );
  }

  if (isError) {
    return (
      <FinancePageShell className="flex flex-col items-center justify-center py-10">
        <p className="text-center text-sm text-red-600 dark:text-red-400">
          {(error as Error)?.message ?? t("error")}
        </p>
        <div className="mt-6 flex justify-center">
          <Button type="button" variant="outline" onClick={() => refetch()}>
            {t("retry")}
          </Button>
        </div>
      </FinancePageShell>
    );
  }

  if (!snapshot) {
    return null;
  }

  return (
    <FinancePageShell className="relative">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-text-muted">
            {formatLongDate(intlLocale, new Date())}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {t(greetingKey as "greetingMorning", {
              name: displayName,
            })}
          </h1>
          <p className="mt-1 text-sm font-medium text-text-secondary">
            {formatMonthYear(intlLocale, year, month)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="relative rounded-full"
              aria-label={t("notifications")}
              aria-expanded={notificationsOpen}
              onClick={() => setNotificationsOpen((o) => !o)}>
              <Bell className="h-5 w-5" />
              {todayReminders.length > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
                  {todayReminders.length > 9 ? "9+" : todayReminders.length}
                </span>
              ) : null}
            </Button>
            {notificationsOpen ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40"
                  aria-label={tNav("cancel")}
                  onClick={() => setNotificationsOpen(false)}
                />
                <div className="surface-modal absolute right-0 z-50 mt-2 w-72 p-3 sm:w-80">
                  <p className="mb-2 text-sm font-semibold">
                    {t("remindersToday")}
                  </p>
                  {todayReminders.length === 0 ? (
                    <p className="text-sm text-text-muted">
                      {t("remindersEmpty")}
                    </p>
                  ) : (
                    <ul className="max-h-64 space-y-2 overflow-y-auto">
                      {todayReminders.map((r) => (
                        <li key={r.id} className="card-layer-2 p-2 text-sm">
                          <p className="font-medium">{r.title || r.content}</p>
                          {r.title ? (
                            <p className="mt-0.5 line-clamp-2 text-text-muted">
                              {r.content}
                            </p>
                          ) : null}
                          <p className="mt-1 text-xs text-text-muted">
                            {new Intl.DateTimeFormat(
                              intlLocale === "es" ? "es-MX" : "en-US",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            ).format(new Date(r.reminder_date))}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full">
                    <Link
                      href="/notes"
                      onClick={() => setNotificationsOpen(false)}>
                      {t("viewAllNotes")}
                    </Link>
                  </Button>
                </div>
              </>
            ) : null}
          </div>
          <FinanceContentHeaderActions />
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            { key: "income", value: snapshot.monthlyIncome, kind: "money" },
            { key: "expense", value: totalExpenses, kind: "money" },
            {
              key: "balance",
              value: balance,
              kind: "money",
              tone: balance >= 0 ? "good" : "bad",
            },
            { key: "savingsRate", value: savingsRate, kind: "percent" },
          ] as const
        ).map((card, i) => (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.35 }}>
            <Card className="card-metric card-layer-1-interactive overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="card-metric-label">
                  {t(`summary.${card.key}.title` as const)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isFetching && !data ? (
                  <Skeleton className="h-8 w-28" />
                ) : card.kind === "percent" ? (
                  <CountUpPercent
                    key={String(card.value)}
                    value={card.value}
                    locale={intlLocale}
                    className="card-metric-value tabular-nums"
                  />
                ) : (
                  <span
                    className={cn(
                      "card-metric-value tabular-nums",
                      "tone" in card &&
                        card.tone === "good" &&
                        "card-metric-value-accent",
                      "tone" in card &&
                        card.tone === "bad" &&
                        "text-red-600 dark:text-red-400",
                    )}>
                    <CountUpNumber
                      key={String(card.value)}
                      value={card.value}
                      locale={intlLocale}
                    />
                  </span>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("paycheck.title")}</h2>
          <div className="inline-flex rounded-lg border border-border-default bg-bg-card p-0.5 dark:border-border-default">
            {([1, 2] as const).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQuincena(q)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition",
                  quincena === q
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-text-secondary hover:text-text-primary dark:text-text-muted",
                )}>
                {t(`paycheck.q${q}` as const)}
              </button>
            ))}
          </div>
        </div>
        <motion.div
          key={quincena}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}>
          <Card>
            <CardContent className="space-y-3 p-4 sm:p-6">
              {filteredPaycheck.length === 0 ? (
                <p className="text-sm text-text-muted">{t("paycheck.empty")}</p>
              ) : (
                filteredPaycheck.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-bg-card-nested/50 p-3 dark:border-border-default sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <CreatorBadge letter={row.creatorInitial} />
                        <p className="font-medium">{row.name}</p>
                      </div>
                      <p className="text-xs text-text-muted">
                        {row.subcategoryName} · {row.due_date}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="outline">{row.accountName}</Badge>
                        <Badge
                          variant={
                            row.status === "paid" ? "success" : "secondary"
                          }>
                          {row.status === "paid"
                            ? t("paycheck.paid")
                            : t("paycheck.pending")}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                      <p className="text-lg font-semibold tabular-nums">
                        {formatMxn(intlLocale, row.amount)}
                      </p>
                      {row.status !== "paid" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={payingId === row.id}
                          onClick={() => void onMarkPaid(row.id, row.name)}>
                          {t("paycheck.markPaid")}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
              <div className="flex items-center justify-between border-t border-border-default pt-4 text-sm font-semibold dark:border-border-default">
                <span>{t("paycheck.total")}</span>
                <span className="tabular-nums">
                  {formatMxn(intlLocale, paycheckTotal)}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("categories.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {donutData.length === 0 ? (
              <p className="text-sm text-text-muted">{t("categories.empty")}</p>
            ) : (
              <>
                <DashboardCategoryChart
                  data={donutData}
                  locale={intlLocale}
                  formatValue={(n) => formatMxn(intlLocale, n)}
                />
                <ul className="mt-4 space-y-2">
                  {snapshot.categorySlices.map((c) => (
                    <li
                      key={c.categoryId}
                      className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: c.color }}
                        />
                        {c.name}
                      </span>
                      <span className="tabular-nums text-text-secondary">
                        {formatMxn(intlLocale, c.amount)} ·{" "}
                        {c.percent.toFixed(0)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("goals.title")}</CardTitle>
              <div className="flex gap-2">
                <Button
                  asChild
                  size="icon"
                  variant="outline"
                  className="h-9 w-9">
                  <Link href="/goals" aria-label={t("goals.add")}>
                    <Plus className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/goals">{t("goals.viewAll")}</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {snapshot.goals.length === 0 ? (
                <p className="text-sm text-text-muted">{t("goals.empty")}</p>
              ) : (
                snapshot.goals.map((g) => {
                  const pct = Math.min(
                    100,
                    (g.current_amount / Math.max(g.target_amount, 1)) * 100,
                  );
                  const left = monthsRemaining(g.target_date);
                  return (
                    <div
                      key={g.id}
                      className="rounded-xl border border-border-default bg-bg-card p-4 dark:border-border-default">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">{g.title}</p>
                        <Badge variant="secondary">
                          {t("goals.monthsLeft", { count: left })}
                        </Badge>
                      </div>
                      <GoalProgressBar percent={pct} color={g.color} />
                      <p className="mt-2 text-xs text-text-muted">
                        {formatMxn(intlLocale, g.current_amount)} /{" "}
                        {formatMxn(intlLocale, g.target_amount)} ·{" "}
                        {g.target_date}
                      </p>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("debts.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-text-muted">
                  {t("debts.total")}
                </span>
                <span className="text-xl font-semibold tabular-nums">
                  {formatMxn(intlLocale, debtTotal)}
                </span>
              </div>
              {nextDebt ? (
                <div className="rounded-lg border border-border-subtle bg-bg-card-nested p-3 text-sm dark:border-border-default">
                  <p className="font-medium">{t("debts.next")}</p>
                  <p className="mt-1 text-text-secondary">
                    {nextDebt.name} · {formatMxn(intlLocale, nextDebt.monthly)}{" "}
                    · {nextDebt.when.toISOString().slice(0, 10)}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-text-muted">{t("debts.empty")}</p>
              )}
              <Button asChild className="w-full">
                <Link href="/debts">{t("debts.cta")}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </FinancePageShell>
  );
}
