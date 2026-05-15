"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CreditCard, Plus, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { FinanceContentHeaderActions } from "@/components/finance/FinanceContentHeaderActions";
import { FinancePageShell } from "@/components/finance/FinancePageShell";
import {
  activateDebtPlan,
  createDebt,
  registerDebtPayment,
} from "@/lib/finance/actions";
import { notify } from "@/lib/toast";
import type { DebtsSnapshot, DebtListItem } from "@/lib/finance/debts-queries";
import { formatMxn, formatShortDate } from "@/lib/finance/format";
import { useEscape } from "@/lib/hooks/use-escape";
import { cn } from "@/lib/utils";

function useIsMobile(breakpoint = 768) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);
  return mobile;
}

type AiPlan = {
  strategy?: string;
  order?: string[];
  timeline?: { debt: string; payoffMonth: string }[];
  comparison?: {
    withoutPlanMonths?: number;
    withPlanMonths?: number;
    interestSavedMxn?: number;
  };
  monthlyExtraMxn?: number;
  analysis?: string;
  active?: boolean;
};

export function DebtsPageClient({
  locale,
  year,
  month,
  initialData,
  loadError,
}: {
  locale: string;
  year: number;
  month: number;
  initialData: DebtsSnapshot | null;
  loadError: string | null;
}) {
  const t = useTranslations("Finance.debts");
  const tc = useTranslations("Finance.common");
  const intlLocale = useLocale();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [newOpen, setNewOpen] = useState(false);
  const [payDebt, setPayDebt] = useState<DebtListItem | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [currentBalance, setCurrentBalance] = useState("");
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [dueDay, setDueDay] = useState("15");
  const [notes, setNotes] = useState("");

  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [isExtra, setIsExtra] = useState(false);
  const [payNotes, setPayNotes] = useState("");

  useEscape(() => setNewOpen(false), newOpen);
  useEscape(() => setPayDebt(null), !!payDebt);
  useEscape(() => setPlanOpen(false), planOpen);

  const { data, isError, refetch, isFetching } = useQuery({
    queryKey: ["finance-debts", year, month, intlLocale],
    queryFn: async () => {
      const qs = new URLSearchParams({
        year: String(year),
        month: String(month),
        locale: intlLocale,
      });
      const res = await fetch(`/api/finance/debts?${qs}`);
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<DebtsSnapshot>;
    },
    initialData: initialData ?? undefined,
  });

  const snapshot = data ?? initialData;
  const firstPlan = snapshot?.debts.find(
    (d) => d.ai_plan && Object.keys(d.ai_plan).length > 1,
  )?.ai_plan as AiPlan | undefined;

  const runDebtPlan = useCallback(async () => {
    setPlanOpen(true);
    const cached =
      typeof firstPlan?.analysis === "string" ? firstPlan.analysis : "";
    setAiText(cached);
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: intlLocale }),
      });
      if (!res.ok || !res.body) {
        setAiText(t("ai.error"));
        notify.ai.error();
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setAiText(acc);
      }
      await queryClient.invalidateQueries({ queryKey: ["finance-debts"] });
    } catch {
      setAiText(t("ai.error"));
      notify.ai.error();
    } finally {
      setAiLoading(false);
    }
  }, [firstPlan, intlLocale, queryClient, t]);

  const displayPlan = (snapshot?.debts[0]?.ai_plan ?? firstPlan) as
    | AiPlan
    | undefined;
  const analysisText =
    aiText ||
    (typeof displayPlan?.analysis === "string" ? displayPlan.analysis : "");

  const handleCreate = async () => {
    setSaving(true);
    const res = await createDebt({
      locale,
      name,
      totalAmount: Number.parseFloat(totalAmount.replace(",", ".")),
      currentBalance: Number.parseFloat(currentBalance.replace(",", ".")),
      monthlyPayment: Number.parseFloat(monthlyPayment.replace(",", ".")),
      interestRate: interestRate
        ? Number.parseFloat(interestRate.replace(",", "."))
        : null,
      dueDay: Number.parseInt(dueDay, 10),
      notes,
    });
    setSaving(false);
    if (res.ok) {
      notify.debts.addSuccess(name.trim() || "Deuda");
      setNewOpen(false);
      setName("");
      await queryClient.invalidateQueries({ queryKey: ["finance-debts"] });
    } else {
      notify.debts.addError();
    }
  };

  const handlePayment = async () => {
    if (!payDebt) return;
    setSaving(true);
    const res = await registerDebtPayment({
      locale,
      debtId: payDebt.id,
      amountPaid: Number.parseFloat(payAmount.replace(",", ".")),
      paymentDate: payDate,
      isExtra,
      notes: payNotes,
    });
    setSaving(false);
    if (res.ok) {
      const debtLabel = payDebt.name;
      setPayDebt(null);
      setPayAmount("");
      await queryClient.invalidateQueries({ queryKey: ["finance-debts"] });
      const paymentAmount = Number.parseFloat(payAmount.replace(",", "."));
      const amtStr = formatMxn(intlLocale, paymentAmount);
      if ("paidOff" in res && res.paidOff) {
        notify.debts.paidOffSuccess(debtLabel);
      } else {
        notify.debts.paymentSuccess(amtStr, debtLabel);
      }
    } else {
      notify.debts.paymentError();
    }
  };

  const togglePlanActive = async () => {
    setSaving(true);
    await activateDebtPlan({
      locale,
      active: !snapshot?.planActive,
    });
    setSaving(false);
    await queryClient.invalidateQueries({ queryKey: ["finance-debts"] });
  };

  if (loadError && !snapshot) {
    return (
      <FinancePageShell className="flex flex-col items-center justify-center py-10 text-center">
        <p className="text-sm text-red-600">{tc("error")}</p>
        <Button className="mt-4" onClick={() => refetch()}>
          {tc("retry")}
        </Button>
      </FinancePageShell>
    );
  }

  return (
    <FinancePageShell>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6">
        <motion.header
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-start justify-between gap-4">
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("title")}
            </h1>
            <p className="mt-1 text-sm text-text-muted">{t("subtitle")}</p>
          </motion.div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-accent text-accent hover:bg-accent-muted"
              onClick={() => runDebtPlan()}>
              <Sparkles className="mr-1 h-4 w-4" />
              {t("ai.plan")}
            </Button>
            <Button size="sm" onClick={() => setNewOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              {t("add")}
            </Button>
            <FinanceContentHeaderActions />
          </div>
        </motion.header>

        {snapshot ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-text-muted">
                  {t("summary.totalDebt")}
                </p>
                <p className="text-lg font-semibold">
                  {formatMxn(intlLocale, snapshot.summary.totalDebt)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-text-muted">
                  {t("summary.monthlyPayments")}
                </p>
                <p className="text-lg font-semibold">
                  {formatMxn(intlLocale, snapshot.summary.totalMonthlyPayments)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-text-muted">
                  {t("summary.incomePercent")}
                </p>
                <p className="text-lg font-semibold">
                  {snapshot.summary.incomePercentToDebts.toFixed(0)}%
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ) : null}

        {isFetching && !snapshot ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </motion.div>
        ) : null}

        {snapshot?.debts.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-text-muted">
              {t("empty")}
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {snapshot?.debts.map((debt, i) => (
            <motion.div
              key={debt.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}>
              <Card>
                <CardHeader className="flex flex-row items-start gap-3 pb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950/40">
                    <CreditCard className="h-5 w-5 text-red-600" />
                  </div>
                  <motion.div
                    className="min-w-0 flex-1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">{debt.name}</CardTitle>
                      <Badge
                        variant={
                          debt.status === "paid_off" ? "default" : "outline"
                        }>
                        {t(`status.${debt.status}`)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-text-muted">
                      {formatMxn(intlLocale, debt.current_balance)} /{" "}
                      {formatMxn(intlLocale, debt.total_amount)}
                    </p>
                  </motion.div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="h-2 overflow-hidden rounded-full bg-bg-card-hover">
                    <motion.div
                      className="h-full rounded-full bg-red-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${debt.payoffProgressPercent}%` }}
                      transition={{ duration: 0.7 }}
                    />
                  </div>
                  <div className="grid gap-1 text-xs text-text-secondary sm:grid-cols-2 dark:text-text-muted">
                    <p>
                      {t("monthlyPayment")}:{" "}
                      {formatMxn(intlLocale, debt.monthly_payment)}
                    </p>
                    <p>
                      {t("dueDay")}: {debt.due_day}
                    </p>
                    {debt.interest_rate != null ? (
                      <p>
                        {t("interestRate")}: {debt.interest_rate}%
                      </p>
                    ) : null}
                    {debt.estimated_payoff_date ? (
                      <p>
                        {t("payoffDate")}:{" "}
                        {formatShortDate(
                          intlLocale,
                          debt.estimated_payoff_date,
                        )}
                      </p>
                    ) : null}
                  </div>
                  {debt.status === "active" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPayDebt(debt);
                        setPayAmount(String(debt.monthly_payment));
                      }}>
                      {t("registerPayment")}
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("form.title")}</DialogTitle>
            </DialogHeader>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3">
              <div>
                <Label>{t("form.name")}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <motion.div
                className="grid gap-3 sm:grid-cols-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.05 }}>
                <motion.div
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}>
                  <Label>{t("form.totalAmount")}</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                  />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 }}>
                  <Label>{t("form.currentBalance")}</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={currentBalance}
                    onChange={(e) => setCurrentBalance(e.target.value)}
                  />
                </motion.div>
              </motion.div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>{t("form.monthlyPayment")}</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={monthlyPayment}
                    onChange={(e) => setMonthlyPayment(e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t("form.interestRate")}</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    placeholder="—"
                  />
                </div>
              </div>
              <div>
                <Label>{t("form.dueDay")}</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                />
              </div>
              <div>
                <Label>{t("form.notes")}</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                disabled={saving || !name.trim()}
                onClick={handleCreate}>
                {saving ? tc("saving") : tc("save")}
              </Button>
            </motion.div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!payDebt} onOpenChange={(o) => !o && setPayDebt(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("payment.title")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{t("payment.amount")}</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </div>
              <div>
                <Label>{t("payment.date")}</Label>
                <Input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isExtra}
                  onChange={(e) => setIsExtra(e.target.checked)}
                  className="rounded"
                />
                {t("payment.isExtra")}
              </label>
              <div>
                <Label>{t("payment.notes")}</Label>
                <Input
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                disabled={saving || !payAmount}
                onClick={handlePayment}>
                {saving ? tc("saving") : tc("save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Sheet open={planOpen} onOpenChange={setPlanOpen}>
          <SheetContent
            side={isMobile ? "bottom" : "right"}
            className={cn(
              "overflow-y-auto",
              isMobile ? "max-h-[92vh]" : "w-full sm:max-w-2xl",
            )}>
            <SheetHeader>
              <SheetTitle>{t("ai.title")}</SheetTitle>
            </SheetHeader>

            <motion.div
              className="mt-4 flex flex-wrap gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}>
              <Button
                size="sm"
                variant="outline"
                disabled={aiLoading}
                onClick={() => runDebtPlan()}>
                {t("ai.regenerate")}
              </Button>
              {displayPlan?.strategy ? (
                <Button
                  size="sm"
                  variant={snapshot?.planActive ? "default" : "outline"}
                  disabled={saving || aiLoading}
                  onClick={togglePlanActive}>
                  {snapshot?.planActive ? t("ai.deactivate") : t("ai.activate")}
                </Button>
              ) : null}
            </motion.div>

            {aiLoading && !analysisText ? (
              <div className="mt-4 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <>
                {displayPlan?.strategy ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 space-y-4">
                    <Badge variant="secondary">
                      {t(`ai.strategy.${displayPlan.strategy}`)}
                    </Badge>

                    {displayPlan.timeline?.length ? (
                      <div>
                        <p className="mb-2 text-sm font-medium">
                          {t("ai.timeline")}
                        </p>
                        <ol className="relative border-l border-border-default pl-4">
                          {displayPlan.timeline.map((item, idx) => (
                            <motion.li
                              key={`${item.debt}-${idx}`}
                              className="mb-4 ml-2"
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.06 }}>
                              <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-accent dark:border-zinc-950" />
                              <p className="text-sm font-medium">{item.debt}</p>
                              <p className="text-xs text-text-muted">
                                {item.payoffMonth}
                              </p>
                            </motion.li>
                          ))}
                        </ol>
                      </div>
                    ) : null}

                    {displayPlan.comparison ? (
                      <div className="overflow-x-auto rounded-lg border border-border-default">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-bg-card-nested">
                            <tr>
                              <th className="px-3 py-2" />
                              <th className="px-3 py-2">
                                {t("ai.withoutPlan")}
                              </th>
                              <th className="px-3 py-2">{t("ai.withPlan")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-t border-border-default">
                              <td className="px-3 py-2">{t("ai.months")}</td>
                              <td className="px-3 py-2">
                                {displayPlan.comparison.withoutPlanMonths ??
                                  "—"}
                              </td>
                              <td className="px-3 py-2 font-medium text-accent">
                                {displayPlan.comparison.withPlanMonths ?? "—"}
                              </td>
                            </tr>
                            <tr className="border-t border-border-default">
                              <td className="px-3 py-2">
                                {t("ai.interestSaved")}
                              </td>
                              <td className="px-3 py-2">—</td>
                              <td className="px-3 py-2 font-medium">
                                {displayPlan.comparison.interestSavedMxn != null
                                  ? formatMxn(
                                      intlLocale,
                                      displayPlan.comparison.interestSavedMxn,
                                    )
                                  : "—"}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </motion.div>
                ) : null}

                <article className="prose prose-sm mt-4 max-w-none whitespace-pre-wrap dark:prose-invert">
                  {analysisText.replace(/```json[\s\S]*?```/g, "").trim() ||
                    t("ai.empty")}
                </article>
              </>
            )}
          </SheetContent>
        </Sheet>

        {isError ? (
          <p className="text-center text-sm text-red-600">{tc("error")}</p>
        ) : null}
      </motion.div>
    </FinancePageShell>
  );
}
