"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Sparkles, Wallet } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

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
import { FinanceHeaderSearchTrigger } from "@/components/finance/finance-header-search-trigger";
import { CreatorBadge } from "@/components/finance/CreatorBadge";
import { FinancePageShell } from "@/components/finance/FinancePageShell";
import { RowDeleteButton } from "@/components/finance/row-delete-button";
import {
  GOAL_COLOR_OPTIONS,
  GOAL_ICON_OPTIONS,
  goalLucideIcon,
} from "@/features/finance/goal-icons";
import { computeGoalMetrics } from "@/lib/finance/goal-calculations";
import {
  addGoalContribution,
  createGoal,
  deleteGoal,
  deleteGoalContribution,
} from "@/lib/finance/actions";
import { notify, toastConfirmDestructive } from "@/lib/toast";
import { formatMxn, formatShortDate } from "@/lib/finance/format";
import type {
  GoalContributionListItem,
  GoalListItem,
  GoalsSnapshot,
} from "@/lib/finance/goals-queries";
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

function statusBadgeVariant(
  status: GoalListItem["status"],
): "default" | "secondary" | "outline" {
  if (status === "completed") return "default";
  if (status === "paused") return "secondary";
  return "outline";
}

export function GoalsPageClient({
  locale,
  year,
  month,
  initialData,
  loadError,
}: {
  locale: string;
  year: number;
  month: number;
  initialData: GoalsSnapshot | null;
  loadError: string | null;
}) {
  const t = useTranslations("Finance.goals");
  const tc = useTranslations("Finance.common");
  const intlLocale = useLocale();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [newOpen, setNewOpen] = useState(false);
  const [contribGoal, setContribGoal] = useState<GoalListItem | null>(null);
  const [aiGoal, setAiGoal] = useState<GoalListItem | null>(null);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<string>("target");
  const [color, setColor] = useState<string>(GOAL_COLOR_OPTIONS[0]);
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("0");
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [sharedGoal, setSharedGoal] = useState(true);

  const [contribAmount, setContribAmount] = useState("");
  const [contribDate, setContribDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [contribNotes, setContribNotes] = useState("");

  useEscape(() => setNewOpen(false), newOpen);
  useEscape(() => setContribGoal(null), !!contribGoal);
  useEscape(() => setAiGoal(null), !!aiGoal);

  const { data, isError, refetch, isFetching } = useQuery({
    queryKey: ["finance-goals", year, month, intlLocale],
    queryFn: async () => {
      const qs = new URLSearchParams({
        year: String(year),
        month: String(month),
        locale: intlLocale,
      });
      const res = await fetch(`/api/finance/goals?${qs}`);
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<GoalsSnapshot>;
    },
    initialData: initialData ?? undefined,
  });

  const snapshot = data ?? initialData;

  const contributionsByGoal = useMemo(() => {
    const m = new Map<string, GoalContributionListItem[]>();
    if (!snapshot) return m;
    for (const c of snapshot.contributions) {
      const list = m.get(c.goal_id) ?? [];
      list.push(c);
      m.set(c.goal_id, list);
    }
    return m;
  }, [snapshot]);

  const previewMetrics = useMemo(() => {
    const target = Number.parseFloat(targetAmount.replace(",", ".")) || 0;
    const current = Number.parseFloat(currentAmount.replace(",", ".")) || 0;
    if (!targetDate) return null;
    return computeGoalMetrics(target, current, targetDate);
  }, [targetAmount, currentAmount, targetDate]);

  const runAiAnalysis = useCallback(
    async (goal: GoalListItem) => {
      setAiGoal(goal);
      const cached =
        typeof goal.ai_suggestions?.analysis === "string"
          ? goal.ai_suggestions.analysis
          : "";
      setAiText(cached);
      setAiLoading(true);

      try {
        const res = await fetch("/api/ai/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goal_id: goal.id, locale: intlLocale }),
        });
        if (!res.ok || !res.body) {
          setAiText(t("ai.error"));
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
        await queryClient.invalidateQueries({ queryKey: ["finance-goals"] });
      } catch {
        setAiText(t("ai.error"));
        notify.ai.error();
      } finally {
        setAiLoading(false);
      }
    },
    [intlLocale, queryClient, t],
  );

  const handleCreate = async () => {
    setSaving(true);
    const target = Number.parseFloat(targetAmount.replace(",", "."));
    const current = Number.parseFloat(currentAmount.replace(",", ".")) || 0;
    const res = await createGoal({
      locale,
      title,
      description,
      icon,
      color,
      targetAmount: target,
      currentAmount: current,
      targetDate,
      sharedGoal,
    });
    setSaving(false);
    if (res.ok) {
      setNewOpen(false);
      notify.goals.addSuccess(title.trim() || "Meta");
      setTitle("");
      setDescription("");
      await queryClient.invalidateQueries({ queryKey: ["finance-goals"] });
    } else {
      notify.goals.addError();
    }
  };

  const handleContribution = async () => {
    if (!contribGoal) return;
    setSaving(true);
    const amount = Number.parseFloat(contribAmount.replace(",", "."));
    const res = await addGoalContribution({
      locale,
      goalId: contribGoal.id,
      amount,
      date: contribDate,
      notes: contribNotes,
    });
    setSaving(false);
    if (res.ok) {
      const goalTitle = contribGoal.title;
      setContribGoal(null);
      setContribAmount("");
      setContribNotes("");
      await queryClient.invalidateQueries({ queryKey: ["finance-goals"] });
      const amtStr = formatMxn(intlLocale, amount);
      if ("goalCompleted" in res && res.goalCompleted) {
        notify.goals.completedSuccess(goalTitle);
      } else {
        notify.goals.contributionSuccess(amtStr, goalTitle);
      }
    } else {
      notify.goals.contributionError();
    }
  };

  const confirmDeleteGoal = (goal: GoalListItem) => {
    toastConfirmDestructive({
      title: tc("deleteNamed", { name: goal.title }),
      description: tc("deleteCannotUndo"),
      duration: 5000,
      confirmLabel: tc("delete"),
      cancelLabel: tc("cancel"),
      onConfirm: async () => {
        const res = await deleteGoal({ locale, goalId: goal.id });
        if (res.ok) {
          notify.goals.deleteSuccess(goal.title);
          await queryClient.invalidateQueries({ queryKey: ["finance-goals"] });
        } else {
          notify.goals.deleteError();
        }
      },
    });
  };

  const confirmDeleteContribution = (
    goalTitle: string,
    row: GoalContributionListItem,
  ) => {
    const name = `${formatMxn(intlLocale, row.amount)} · ${formatShortDate(intlLocale, row.date)}`;
    toastConfirmDestructive({
      title: tc("deleteNamed", { name }),
      description: tc("deleteCannotUndo"),
      duration: 5000,
      confirmLabel: tc("delete"),
      cancelLabel: tc("cancel"),
      onConfirm: async () => {
        const res = await deleteGoalContribution({
          locale,
          contributionId: row.id,
        });
        if (res.ok) {
          notify.goals.contributionDeleteSuccess(goalTitle);
          await queryClient.invalidateQueries({ queryKey: ["finance-goals"] });
        } else {
          notify.goals.contributionDeleteError();
        }
      },
    });
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
          className="relative flex items-start justify-between gap-4">
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("title")}
            </h1>
            <p className="mt-1 text-sm text-text-muted">{t("subtitle")}</p>
          </motion.div>
          <FinanceHeaderSearchTrigger />
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Button onClick={() => setNewOpen(true)} size="sm">
              <Plus className="mr-1 h-4 w-4" />
              {t("add")}
            </Button>
            <FinanceContentHeaderActions />
          </div>
        </motion.header>

        {isFetching && !snapshot ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3">
            <Skeleton className="h-36 w-full rounded-xl" />
            <Skeleton className="h-36 w-full rounded-xl" />
          </motion.div>
        ) : null}

        {snapshot && snapshot.goals.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-text-muted">
              {t("empty")}
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {snapshot?.goals.map((goal, i) => {
            const Icon = goalLucideIcon(goal.icon);
            const contribList = contributionsByGoal.get(goal.id) ?? [];
            return (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}>
                <Card className="group overflow-hidden">
                  <CardHeader className="flex flex-row items-start gap-3 pb-2">
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${goal.color}22` }}>
                      <Icon className="h-5 w-5" style={{ color: goal.color }} />
                    </motion.div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <CreatorBadge letter={goal.creatorInitial} />
                        <CardTitle className="text-base">
                          {goal.title}
                        </CardTitle>
                        <Badge variant={statusBadgeVariant(goal.status)}>
                          {t(`status.${goal.status}`)}
                        </Badge>
                        {goal.shared_goal ? (
                          <Badge variant="outline">{t("shared")}</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-text-muted">
                        {formatMxn(intlLocale, goal.current_amount)} /{" "}
                        {formatMxn(intlLocale, goal.target_amount)}
                      </p>
                    </div>
                    <RowDeleteButton
                      ariaLabel={tc("delete")}
                      onClick={() => confirmDeleteGoal(goal)}
                    />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <motion.div
                      className="h-2 overflow-hidden rounded-full bg-bg-card-hover"
                      initial={false}>
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${goal.progressPercent}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="grid gap-2 text-xs text-text-secondary sm:grid-cols-2 dark:text-text-muted">
                      <p>{t("monthsLeft", { count: goal.monthsLeft })}</p>
                      <p>
                        {t("monthlySave")}:{" "}
                        <span className="font-medium text-text-primary">
                          {formatMxn(intlLocale, goal.monthlyRequired)}
                        </span>
                      </p>
                      <p>
                        {t("targetDate")}:{" "}
                        {formatShortDate(intlLocale, goal.target_date)}
                      </p>
                    </motion.div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setContribGoal(goal);
                          setContribAmount("");
                        }}>
                        <Wallet className="mr-1 h-3.5 w-3.5" />
                        {t("addContribution")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => runAiAnalysis(goal)}
                        disabled={aiLoading && aiGoal?.id === goal.id}>
                        <Sparkles className="mr-1 h-3.5 w-3.5" />
                        {t("ai.analyze")}
                      </Button>
                    </div>
                    {contribList.length > 0 ? (
                      <div className="border-t border-border-subtle pt-3">
                        <p className="mb-2 text-xs font-medium text-text-muted">
                          {t("contributionsTitle")}
                        </p>
                        <ul className="space-y-1.5">
                          {contribList.map((c) => (
                            <li
                              key={c.id}
                              className="group flex items-center justify-between gap-2 rounded-lg border border-border-subtle bg-bg-card-nested/80 px-2 py-1.5 text-xs dark:border-border-default">
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <CreatorBadge letter={c.creatorInitial} />
                                <span className="text-text-muted">
                                  {formatShortDate(intlLocale, c.date)}
                                </span>
                                <span className="font-semibold tabular-nums">
                                  {formatMxn(intlLocale, c.amount)}
                                </span>
                              </div>
                              <RowDeleteButton
                                ariaLabel={tc("delete")}
                                onClick={() =>
                                  confirmDeleteContribution(goal.title, c)
                                }
                              />
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("form.title")}</DialogTitle>
            </DialogHeader>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}>
                <Label>{t("form.goalTitle")}</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("form.goalTitlePlaceholder")}
                />
              </motion.div>
              <div>
                <Label>{t("form.icon")}</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {GOAL_ICON_OPTIONS.map((key) => {
                    const Ic = goalLucideIcon(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setIcon(key)}
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg border transition",
                          icon === key
                            ? "border-accent bg-accent-muted"
                            : "border-border-default",
                        )}>
                        <Ic className="h-4 w-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}>
                <Label>{t("form.color")}</Label>
                <motion.div
                  className="mt-2 flex flex-wrap gap-2"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: {},
                    visible: { transition: { staggerChildren: 0.03 } },
                  }}>
                  {GOAL_COLOR_OPTIONS.map((c) => (
                    <motion.button
                      key={c}
                      type="button"
                      variants={{
                        hidden: { opacity: 0, scale: 0.8 },
                        visible: { opacity: 1, scale: 1 },
                      }}
                      onClick={() => setColor(c)}
                      className={cn(
                        "h-8 w-8 rounded-full border-2 transition",
                        color === c
                          ? "border-zinc-900 dark:border-white"
                          : "border-transparent",
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </motion.div>
              </motion.div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>{t("form.targetAmount")}</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                  />
                </div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.08 }}>
                  <Label>{t("form.currentAmount")}</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={currentAmount}
                    onChange={(e) => setCurrentAmount(e.target.value)}
                  />
                </motion.div>
              </div>
              <div>
                <Label>{t("form.targetDate")}</Label>
                <Input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </div>
              {previewMetrics ? (
                <Card className="border-dashed card-layer-2">
                  <CardContent className="space-y-1 py-3 text-sm">
                    <p className="font-medium text-text-secondary">
                      {t("form.calculated")}
                    </p>
                    <p>
                      {t("monthsLeft", { count: previewMetrics.monthsLeft })}
                    </p>
                    <p>
                      {t("form.monthlyRequired")}:{" "}
                      {formatMxn(intlLocale, previewMetrics.monthlyRequired)}
                    </p>
                    <p>
                      {t("form.biweeklyRequired")}:{" "}
                      {formatMxn(intlLocale, previewMetrics.biweeklyRequired)}
                    </p>
                  </CardContent>
                </Card>
              ) : null}
              <div>
                <Label>{t("form.notes")}</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sharedGoal}
                  onChange={(e) => setSharedGoal(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                {t("form.shared")}
              </label>
              <Button
                className="w-full"
                disabled={saving || !title.trim() || !targetAmount}
                onClick={handleCreate}>
                {saving ? tc("saving") : tc("save")}
              </Button>
            </motion.div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!contribGoal}
          onOpenChange={(o) => !o && setContribGoal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("contribution.title")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Label>{t("contribution.amount")}</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={contribAmount}
                  onChange={(e) => setContribAmount(e.target.value)}
                />
              </motion.div>
              <div>
                <Label>{t("contribution.date")}</Label>
                <Input
                  type="date"
                  value={contribDate}
                  onChange={(e) => setContribDate(e.target.value)}
                />
              </div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.05 }}>
                <Label>{t("contribution.notes")}</Label>
                <Input
                  value={contribNotes}
                  onChange={(e) => setContribNotes(e.target.value)}
                />
              </motion.div>
              <Button
                className="w-full"
                disabled={saving || !contribAmount}
                onClick={handleContribution}>
                {saving ? tc("saving") : tc("save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Sheet open={!!aiGoal} onOpenChange={(o) => !o && setAiGoal(null)}>
          <SheetContent
            side={isMobile ? "bottom" : "right"}
            className={cn(
              "overflow-y-auto",
              isMobile ? "max-h-[88vh]" : "w-full sm:max-w-xl",
            )}>
            <SheetHeader>
              <SheetTitle>
                {t("ai.title")} — {aiGoal?.title}
              </SheetTitle>
            </SheetHeader>
            {aiLoading && !aiText ? (
              <div className="mt-4 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : (
              <article className="prose prose-sm mt-4 max-w-none whitespace-pre-wrap dark:prose-invert">
                {aiText || t("ai.empty")}
              </article>
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
