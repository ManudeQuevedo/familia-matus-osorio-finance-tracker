"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { createIncome } from "@/lib/finance/actions";
import {
  formatMxn,
  formatMonthYear,
  formatShortDate,
  formatUsd,
} from "@/lib/finance/format";
import type { HouseholdPerson } from "@/lib/finance/household";
import { FinancePageShell } from "@/components/finance/FinancePageShell";
import type { IncomesSnapshot } from "@/lib/finance/incomes-queries";

export function IncomesPageClient({
  locale,
  year: initialYear,
  month: initialMonth,
  initialData,
  loadError,
  currentUserId,
}: {
  locale: string;
  year: number;
  month: number;
  initialData: IncomesSnapshot | null;
  loadError: string | null;
  currentUserId: string;
}) {
  const t = useTranslations("Finance.incomes");
  const tc = useTranslations("Finance.common");
  const intlLocale = useLocale();
  const queryClient = useQueryClient();

  const [viewYear, setViewYear] = useState(initialYear);
  const [viewMonth, setViewMonth] = useState(initialMonth);
  const [saving, setSaving] = useState(false);

  const [who, setWho] = useState<HouseholdPerson>("manuel");
  const [amountUsd, setAmountUsd] = useState("");
  const [exchangeRate, setExchangeRate] = useState("");
  const [amountMxn, setAmountMxn] = useState("");
  const [incomeKind, setIncomeKind] = useState<
    "payrollQ1" | "payrollQ2" | "bonus"
  >("payrollQ1");
  const [receivedDate, setReceivedDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");

  const { data, isError, error, refetch, isFetching, isPending } = useQuery({
    queryKey: ["finance-incomes", viewYear, viewMonth, intlLocale],
    queryFn: async () => {
      const qs = new URLSearchParams({
        year: String(viewYear),
        month: String(viewMonth),
        locale: intlLocale,
      });
      const res = await fetch(`/api/finance/incomes?${qs}`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed");
      }
      return res.json() as Promise<IncomesSnapshot>;
    },
    initialData:
      viewYear === initialYear && viewMonth === initialMonth
        ? (initialData ?? undefined)
        : undefined,
    refetchOnMount: "always",
  });

  const snapshot =
    data ??
    (viewYear === initialYear && viewMonth === initialMonth
      ? initialData
      : null);

  const computedMxn = useMemo(() => {
    const usd = Number.parseFloat(amountUsd.replace(",", "."));
    const rate = Number.parseFloat(exchangeRate.replace(",", "."));
    if (!Number.isFinite(usd) || !Number.isFinite(rate)) return 0;
    return Math.round(usd * rate * 100) / 100;
  }, [amountUsd, exchangeRate]);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["finance-incomes"] });
    void queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["finance-reports"] });
  }, [queryClient]);

  const personUserId = useMemo(() => {
    if (!snapshot) return currentUserId;
    const match = snapshot.householdProfiles.find((p) => p.person === who);
    return match?.id ?? currentUserId;
  }, [snapshot, who, currentUserId]);

  const groupedIncomes = useMemo(() => {
    if (!snapshot) return [];
    const groups = new Map<string, typeof snapshot.incomes>();
    for (const row of snapshot.incomes) {
      const list = groups.get(row.personLabel) ?? [];
      list.push(row);
      groups.set(row.personLabel, list);
    }
    return [...groups.entries()];
  }, [snapshot]);

  const typeLabel = (type: string) => {
    if (type === "salary") return t("list.salary");
    if (type === "bonus") return t("list.bonus");
    return t("list.other");
  };

  const onSubmit = async () => {
    if (!snapshot || !snapshot.accounts.length) return;
    const acc = snapshot.accounts[0]!.id;

    let payload: Parameters<typeof createIncome>[0];

    if (who === "manuel") {
      if (computedMxn <= 0) return;
      payload = {
        locale,
        accountId: acc,
        personUserId,
        type: "salary",
        amountMxn: computedMxn,
        amountUsd: Number.parseFloat(amountUsd.replace(",", ".")),
        exchangeRate: Number.parseFloat(exchangeRate.replace(",", ".")),
        receivedDate,
        notes,
        year: viewYear,
        month: viewMonth,
      };
    } else {
      const mxn = Number.parseFloat(amountMxn.replace(",", "."));
      if (!Number.isFinite(mxn) || mxn <= 0) return;
      const isBonus = incomeKind === "bonus";
      payload = {
        locale,
        accountId: acc,
        personUserId,
        type: isBonus ? "bonus" : "salary",
        amountMxn: mxn,
        paycheckNumber: isBonus ? null : incomeKind === "payrollQ1" ? 1 : 2,
        receivedDate,
        notes,
        year: viewYear,
        month: viewMonth,
      };
    }

    setSaving(true);
    const res = await createIncome(payload);
    setSaving(false);
    if (res.ok) {
      setAmountUsd("");
      setExchangeRate("");
      setAmountMxn("");
      setNotes("");
      invalidate();
    }
  };

  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const yearOptions = Array.from({ length: 5 }, (_, i) => initialYear - 2 + i);

  if (!snapshot && (isPending || isFetching)) {
    return (
      <motion.div className="px-4 py-10">
        <Skeleton className="h-32 w-full" />
      </motion.div>
    );
  }

  if (isError || (loadError && !snapshot)) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mx-auto max-w-2xl px-4 py-10 text-center">
        <p className="text-sm text-red-600">
          {(error as Error)?.message ?? loadError ?? tc("error")}
        </p>
        <Button className="mt-4" variant="outline" onClick={() => refetch()}>
          {tc("retry")}
        </Button>
      </motion.div>
    );
  }

  if (!snapshot) {
    return (
      <motion.div className="px-4 py-10">
        <Skeleton className="h-32 w-full" />
      </motion.div>
    );
  }

  return (
    <FinancePageShell>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8">
        <header>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-1 text-sm text-text-muted">
            {formatMonthYear(intlLocale, viewYear, viewMonth)}
          </p>
        </header>

        <section>
          <h2 className="mb-3 text-lg font-semibold">{t("form.title")}</h2>
          <Card>
            <CardContent className="space-y-4 pt-6">
              <motion.div>
                <Label>{t("form.who")}</Label>
                <Select
                  value={who}
                  onValueChange={(v) => setWho(v as HouseholdPerson)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manuel">{t("form.manuel")}</SelectItem>
                    <SelectItem value="carolina">
                      {t("form.carolina")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </motion.div>

              {who === "manuel" ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <motion.div layout>
                    <Label>{t("form.amountUsd")}</Label>
                    <Input
                      inputMode="decimal"
                      className="mt-1"
                      value={amountUsd}
                      onChange={(e) => setAmountUsd(e.target.value)}
                    />
                  </motion.div>
                  <div>
                    <Label>{t("form.exchangeRate")}</Label>
                    <Input
                      inputMode="decimal"
                      className="mt-1"
                      value={exchangeRate}
                      onChange={(e) => setExchangeRate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>{t("form.amountMxnComputed")}</Label>
                    <Input
                      className="mt-1 bg-bg-card-nested bg-bg-card-nested"
                      readOnly
                      value={
                        computedMxn > 0
                          ? formatMxn(intlLocale, computedMxn)
                          : ""
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>{t("form.amountMxn")}</Label>
                    <Input
                      inputMode="decimal"
                      className="mt-1"
                      value={amountMxn}
                      onChange={(e) => setAmountMxn(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>{t("form.incomeKind")}</Label>
                    <Select
                      value={incomeKind}
                      onValueChange={(v) =>
                        setIncomeKind(v as typeof incomeKind)
                      }>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="payrollQ1">
                          {t("form.payrollQ1")}
                        </SelectItem>
                        <SelectItem value="payrollQ2">
                          {t("form.payrollQ2")}
                        </SelectItem>
                        <SelectItem value="bonus">{t("form.bonus")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>{t("form.date")}</Label>
                  <Input
                    type="date"
                    className="mt-1"
                    value={receivedDate}
                    onChange={(e) => setReceivedDate(e.target.value)}
                  />
                </div>
                <motion.div layout>
                  <Label>{t("form.notes")}</Label>
                  <Input
                    className="mt-1"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </motion.div>
              </div>

              {snapshot.accounts.length === 0 ? (
                <p className="text-sm text-amber-600">{t("form.noAccounts")}</p>
              ) : (
                <Button
                  className="w-full sm:w-auto"
                  disabled={saving}
                  onClick={onSubmit}>
                  {saving ? tc("saving") : tc("save")}
                </Button>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">{t("summary.title")}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-text-muted">
                    {t("summary.manuel")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-semibold tabular-nums">
                    {formatMxn(intlLocale, snapshot.manuel.totalMxn)}
                  </p>
                  {snapshot.manuel.usdTotal > 0 &&
                  snapshot.manuel.avgExchangeRate ? (
                    <p className="mt-1 text-xs text-text-muted">
                      {t("summary.usdBreakdown", {
                        usd: formatUsd(intlLocale, snapshot.manuel.usdTotal),
                        rate: snapshot.manuel.avgExchangeRate.toFixed(2),
                        mxn: formatMxn(intlLocale, snapshot.manuel.totalMxn),
                      })}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 }}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-text-muted">
                    {t("summary.carolina")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-semibold tabular-nums">
                    {formatMxn(intlLocale, snapshot.carolina.totalMxn)}
                  </p>
                  <motion.div className="mt-2 space-y-0.5 text-xs text-text-muted">
                    <p>
                      {t("summary.carolinaQ1")}:{" "}
                      {formatMxn(intlLocale, snapshot.carolina.salaryQ1)}
                    </p>
                    <p>
                      {t("summary.carolinaQ2")}:{" "}
                      {formatMxn(intlLocale, snapshot.carolina.salaryQ2)}
                    </p>
                    <p>
                      {t("summary.bonuses")}:{" "}
                      {formatMxn(intlLocale, snapshot.carolina.bonuses)}
                    </p>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}>
              <Card className="border-accent/30 bg-accent-muted">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-text-muted">
                    {t("summary.family")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-semibold tabular-nums text-accent">
                    {formatMxn(intlLocale, snapshot.familyTotalMxn)}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">{t("list.title")}</h2>
          {isFetching && !data ? (
            <Skeleton className="h-24 w-full" />
          ) : groupedIncomes.length === 0 ? (
            <p className="text-sm text-text-muted">{t("list.empty")}</p>
          ) : (
            <div className="space-y-6">
              {groupedIncomes.map(([personLabel, rows]) => (
                <motion.div
                  key={personLabel}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}>
                  <h3 className="mb-2 text-sm font-semibold text-text-secondary">
                    {personLabel}
                  </h3>
                  <ul className="space-y-2">
                    {rows.map((row) => (
                      <li
                        key={row.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-default bg-bg-card px-4 py-3 dark:border-border-default bg-bg-card">
                        <div>
                          <p className="font-medium">{typeLabel(row.type)}</p>
                          <p className="text-xs text-text-muted">
                            {formatShortDate(intlLocale, row.received_date)}
                            {row.notes ? ` · ${row.notes}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {row.paycheck_number ? (
                            <Badge variant="outline">
                              {row.paycheck_number === 1
                                ? t("list.paycheckQ1")
                                : t("list.paycheckQ2")}
                            </Badge>
                          ) : null}
                          <span className="font-semibold tabular-nums">
                            {formatMxn(intlLocale, row.amount_mxn)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">{t("history.title")}</h2>
          <Card>
            <CardContent className="flex flex-wrap gap-3 pt-6">
              <div className="min-w-[120px] flex-1 sm:max-w-xs">
                <Label>{t("history.month")}</Label>
                <Select
                  value={String(viewMonth)}
                  onValueChange={(v) => setViewMonth(Number(v))}>
                  <SelectTrigger className="mt-1">
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
              <div className="min-w-[100px] flex-1 sm:max-w-xs">
                <Label>{t("history.year")}</Label>
                <Select
                  value={String(viewYear)}
                  onValueChange={(v) => setViewYear(Number(v))}>
                  <SelectTrigger className="mt-1">
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
            </CardContent>
          </Card>
        </section>
      </motion.div>
    </FinancePageShell>
  );
}
