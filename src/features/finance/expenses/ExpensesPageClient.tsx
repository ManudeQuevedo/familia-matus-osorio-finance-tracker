"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { History, Pencil, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { categoryLucideIcon } from "@/features/finance/category-lucide";
import {
  createRecurringExpense,
  createSubcategory,
  createVariableExpense,
  deleteVariableExpense,
  getRecurringExpenseHistory,
  markExpenseRecordPaid,
  updateExpenseRecordPaidAmount,
} from "@/lib/finance/actions";
import { toastConfirmDestructive, notify } from "@/lib/toast";
import { FinanceContentHeaderActions } from "@/components/finance/FinanceContentHeaderActions";
import { FinancePageShell } from "@/components/finance/FinancePageShell";
import type { ExpensesSnapshot } from "@/lib/finance/expenses-queries";
import {
  formatDayHeading,
  formatMxn,
  formatMonthYear,
  formatShortDate,
} from "@/lib/finance/format";
import { uiQuincenaToDbPeriod } from "@/lib/finance/household";
import { useEscape } from "@/lib/hooks/use-escape";
import { cn } from "@/lib/utils";

type Tab = "recurring" | "variable" | "add";
type FormKind = "recurring" | "variable";

function CategoryPills({
  categories,
  locale,
  value,
  onChange,
  allLabel,
}: {
  categories: ExpensesSnapshot["categories"];
  locale: string;
  value: string | null;
  onChange: (id: string | null) => void;
  allLabel: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="-mx-1 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition",
          value === null
            ? "border-accent bg-primary text-primary-foreground"
            : "border-border-default bg-bg-card dark:border-border-default",
        )}>
        {allLabel}
      </button>
      {categories.map((c) => {
        const Icon = categoryLucideIcon(c.icon);
        const active = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
              active
                ? "border-accent bg-accent-muted text-accent"
                : "border-border-default bg-bg-card dark:border-border-default",
            )}>
            <Icon className="h-3.5 w-3.5" style={{ color: c.color }} />
            {locale === "es" ? c.name_es : c.name_en}
          </button>
        );
      })}
    </motion.div>
  );
}

function SwipeRow({
  children,
  onDelete,
  deleteLabel,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  deleteLabel: string;
}) {
  const x = useMotionValue(0);
  const bg = useTransform(
    x,
    [-120, 0],
    ["rgb(239 68 68)", "rgb(239 68 68 / 0)"],
  );

  return (
    <motion.div className="relative overflow-hidden rounded-xl">
      <motion.div
        className="absolute inset-y-0 right-0 flex w-24 items-center justify-center"
        style={{ backgroundColor: bg }}>
        <button
          type="button"
          onClick={onDelete}
          className="flex flex-col items-center gap-1 text-xs font-medium text-white"
          aria-label={deleteLabel}>
          <Trash2 className="h-5 w-5" />
        </button>
      </motion.div>
      <motion.div
        drag="x"
        dragConstraints={{ left: -96, right: 0 }}
        dragElastic={0.1}
        style={{ x }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -72) onDelete();
        }}
        className="relative z-10 bg-bg-card">
        {children}
      </motion.div>
    </motion.div>
  );
}

export function ExpensesPageClient({
  locale,
  year,
  month,
  initialData,
  loadError,
}: {
  locale: string;
  year: number;
  month: number;
  initialData: ExpensesSnapshot | null;
  loadError: string | null;
}) {
  const t = useTranslations("Finance.expenses");
  const tc = useTranslations("Finance.common");
  const intlLocale = useLocale();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>("recurring");
  const [quincena, setQuincena] = useState<1 | 2>(1);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [formKind, setFormKind] = useState<FormKind>("recurring");
  const [saving, setSaving] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [editRecordId, setEditRecordId] = useState<string | null>(null);
  const [editAmountStr, setEditAmountStr] = useState("");
  const [historyRecurringId, setHistoryRecurringId] = useState<string | null>(
    null,
  );
  const [historyRows, setHistoryRows] = useState<
    Awaited<ReturnType<typeof getRecurringExpenseHistory>>["data"]
  >([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const { data, isError, error, refetch, isFetching, isPending } = useQuery({
    queryKey: ["finance-expenses", year, month, intlLocale],
    queryFn: async () => {
      const qs = new URLSearchParams({
        year: String(year),
        month: String(month),
        locale: intlLocale,
      });
      const res = await fetch(`/api/finance/expenses?${qs}`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed");
      }
      return res.json() as Promise<ExpensesSnapshot>;
    },
    initialData: initialData ?? undefined,
    refetchOnMount: "always",
  });

  const snapshot = data ?? initialData;
  const dbPeriod = uiQuincenaToDbPeriod(quincena);

  const filteredRecurring = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.expenseRecords.filter((r) => {
      if (r.paycheck_period !== dbPeriod) return false;
      if (!categoryFilter) return true;
      const cat = snapshot.categories.find(
        (c) => (intlLocale === "es" ? c.name_es : c.name_en) === r.categoryName,
      );
      return cat?.id === categoryFilter;
    });
  }, [snapshot, dbPeriod, categoryFilter, intlLocale]);

  const recurringTotal = filteredRecurring.reduce((s, r) => s + r.amount, 0);

  const filteredVariable = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.variableExpenses.filter((v) => {
      if (categoryFilter && v.categoryId !== categoryFilter) return false;
      if (dateFrom && v.date < dateFrom) return false;
      if (dateTo && v.date > dateTo) return false;
      return true;
    });
  }, [snapshot, categoryFilter, dateFrom, dateTo]);

  const variableTotal = filteredVariable.reduce((s, v) => s + v.amount, 0);

  const variableByDay = useMemo(() => {
    const map = new Map<string, typeof filteredVariable>();
    for (const v of filteredVariable) {
      const list = map.get(v.date) ?? [];
      list.push(v);
      map.set(v.date, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredVariable]);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["finance-expenses"] });
    void queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] });
  }, [queryClient]);

  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formSubcategoryId, setFormSubcategoryId] = useState("");
  const [formAccountId, setFormAccountId] = useState("");
  const [formPaycheck, setFormPaycheck] = useState<"1" | "2">("1");
  const [formDueEvery, setFormDueEvery] = useState(false);
  const [formDueDay, setFormDueDay] = useState("15");
  const [formActive, setFormActive] = useState(true);
  const [formNotes, setFormNotes] = useState("");
  const [formDate, setFormDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [newSubName, setNewSubName] = useState("");
  const [showNewSub, setShowNewSub] = useState(false);

  useEscape(() => setEditRecordId(null), Boolean(editRecordId));
  useEscape(() => setHistoryRecurringId(null), Boolean(historyRecurringId));

  const categoryId = formCategoryId || snapshot?.categories[0]?.id || "";
  const subsForCat =
    snapshot?.subcategories.filter((s) => s.category_id === categoryId) ?? [];

  const openHistory = async (recurringId: string) => {
    setHistoryRecurringId(recurringId);
    setHistoryLoading(true);
    const res = await getRecurringExpenseHistory(recurringId);
    setHistoryLoading(false);
    if (res.ok) setHistoryRows(res.data);
  };

  const statusBadge = (status: string, dueDate: string) => {
    const today = todayIsoDate();
    const effective =
      status === "pending" && dueDate < today ? "overdue" : status;
    const variant =
      effective === "paid"
        ? "default"
        : effective === "overdue"
          ? "destructive"
          : "outline";
    const label =
      effective === "paid"
        ? t("status.paid")
        : effective === "overdue"
          ? t("status.overdue")
          : t("status.pending");
    return <Badge variant={variant}>{label}</Badge>;
  };

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

  const onSaveEditAmount = async () => {
    if (!editRecordId) return;
    const amount = Number.parseFloat(editAmountStr.replace(",", "."));
    if (!Number.isFinite(amount)) return;
    setSaving(true);
    const res = await updateExpenseRecordPaidAmount({
      locale,
      recordId: editRecordId,
      amount,
    });
    setSaving(false);
    if (res.ok) {
      setEditRecordId(null);
      invalidate();
      notify.expenses.updateSuccess();
    } else {
      notify.expenses.updateError();
    }
  };

  const runDeleteVariable = async (id: string, name: string) => {
    const res = await deleteVariableExpense(id, locale);
    if (res.ok) {
      notify.expenses.deleteSuccess(name);
      invalidate();
    } else {
      notify.expenses.deleteError();
    }
  };

  const confirmDeleteVariable = (id: string, name: string) => {
    toastConfirmDestructive({
      title: `¿Eliminar "${name}"?`,
      confirmLabel: tc("delete"),
      cancelLabel: tc("cancel"),
      onConfirm: () => runDeleteVariable(id, name),
    });
  };

  const onCreateSub = async () => {
    if (!categoryId || !newSubName.trim()) return;
    setSaving(true);
    const res = await createSubcategory({
      locale,
      categoryId,
      name: newSubName.trim(),
    });
    setSaving(false);
    if (res.ok && res.subcategory) {
      setFormSubcategoryId(res.subcategory.id);
      setShowNewSub(false);
      setNewSubName("");
      invalidate();
      notify.generic.saved();
    } else {
      notify.generic.unexpectedError();
    }
  };

  const onSubmitForm = async () => {
    if (!snapshot) return;
    const amount = Number.parseFloat(formAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount < 0) return;

    setSaving(true);
    if (formKind === "variable") {
      const variableDescription = formDesc.trim() || formName.trim() || "Gasto";
      const res = await createVariableExpense({
        locale,
        amount,
        categoryId,
        subcategoryId: formSubcategoryId || null,
        description: variableDescription || " ",
        date: formDate,
      });
      setSaving(false);
      if (res.ok) {
        setFormAmount("");
        setFormDesc("");
        setFormName("");
        setTab("variable");
        invalidate();
        notify.expenses.addSuccess(variableDescription);
      } else {
        notify.expenses.addError();
      }
      return;
    }

    if (!formAccountId && snapshot.accounts[0]) {
      setFormAccountId(snapshot.accounts[0].id);
    }
    const accountId = formAccountId || snapshot.accounts[0]?.id;
    if (!accountId || !formSubcategoryId) {
      setSaving(false);
      return;
    }

    const recurringName = formName.trim();
    const res = await createRecurringExpense({
      locale,
      name: recurringName,
      subcategoryId: formSubcategoryId,
      accountId,
      amount,
      paycheckPeriod: uiQuincenaToDbPeriod(Number(formPaycheck) as 1 | 2),
      dueDay: formDueEvery ? null : Number(formDueDay) || null,
      isActive: formActive,
      notes: formNotes,
      year,
      month,
    });
    setSaving(false);
    if (res.ok) {
      setFormName("");
      setFormAmount("");
      setFormNotes("");
      setTab("recurring");
      invalidate();
      notify.expenses.addSuccess(recurringName);
    } else {
      notify.expenses.addError();
    }
  };

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
        transition={{ duration: 0.35 }}
        className="w-full">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("title")}
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              {formatMonthYear(intlLocale, year, month)}
            </p>
          </div>
          <FinanceContentHeaderActions />
        </header>

        <motion.div
          layout
          className="mb-6 inline-flex w-full rounded-lg border border-border-default bg-bg-card p-0.5 dark:border-border-default sm:w-auto">
          {(["recurring", "variable", "add"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "flex-1 rounded-md px-4 py-2 text-sm font-medium transition sm:flex-none",
                tab === key
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-text-secondary dark:text-text-muted",
              )}>
              {t(`tabs.${key}`)}
            </button>
          ))}
        </motion.div>

        <AnimatePresence mode="wait">
          {tab === "recurring" && (
            <motion.section
              key="recurring"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.25 }}>
              <motion.div
                layout
                className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <motion.div
                  layout
                  className="inline-flex rounded-lg border border-border-default bg-bg-card p-0.5 dark:border-border-default">
                  {([1, 2] as const).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQuincena(q)}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm font-medium",
                        quincena === q
                          ? "bg-primary text-primary-foreground"
                          : "text-text-secondary",
                      )}>
                      {t(`quincena.q${q}`)}
                    </button>
                  ))}
                </motion.div>
                <p className="text-sm font-semibold tabular-nums text-accent">
                  {t("quincena.total")}: {formatMxn(intlLocale, recurringTotal)}
                </p>
              </motion.div>

              <CategoryPills
                categories={snapshot.categories}
                locale={intlLocale}
                value={categoryFilter}
                onChange={setCategoryFilter}
                allLabel={tc("all")}
              />

              <div className="mt-4 flex justify-end">
                <Button
                  size="sm"
                  onClick={() => {
                    setFormKind("recurring");
                    setTab("add");
                  }}>
                  {t("recurring.add")}
                </Button>
              </div>

              {isFetching && !data ? (
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : filteredRecurring.length === 0 ? (
                <p className="mt-8 text-center text-sm text-text-muted">
                  {t("recurring.empty")}
                </p>
              ) : (
                <div className="mt-4 space-y-2">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hidden gap-2 rounded-lg bg-bg-card-nested px-3 py-2 text-xs font-medium text-text-secondary md:grid md:grid-cols-[1.4fr_1fr_0.7fr_0.7fr_0.8fr_0.7fr] dark:text-text-muted">
                    <span>{t("recurring.columns.name")}</span>
                    <span>{t("recurring.columns.subcategory")}</span>
                    <span>{t("recurring.columns.due")}</span>
                    <span>{t("recurring.columns.amount")}</span>
                    <span>{t("recurring.columns.account")}</span>
                    <span>{t("recurring.columns.status")}</span>
                  </motion.div>
                  {filteredRecurring.map((row, i) => {
                    const template = snapshot.recurringTemplates.find(
                      (rt) => rt.name === row.name,
                    );
                    return (
                      <motion.div
                        key={row.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}>
                        <Card className="overflow-hidden">
                          <CardContent className="grid gap-3 p-4 md:grid-cols-[1.4fr_1fr_0.7fr_0.7fr_0.8fr_auto] md:items-center md:gap-2">
                            <motion.div layout="position">
                              <p className="font-medium">{row.name}</p>
                              <p className="text-xs text-text-muted md:hidden">
                                {row.subcategoryName}
                              </p>
                            </motion.div>
                            <span className="hidden text-sm md:block">
                              {row.subcategoryName}
                            </span>
                            <span className="text-sm tabular-nums">
                              {formatShortDate(intlLocale, row.due_date)}
                            </span>
                            <span className="font-semibold tabular-nums">
                              {formatMxn(intlLocale, row.amount)}
                            </span>
                            <span className="text-sm text-text-secondary">
                              {row.accountName}
                            </span>
                            <motion.div
                              layout
                              className="flex flex-wrap items-center gap-2">
                              {statusBadge(row.status, row.due_date)}
                              {row.status !== "paid" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={payingId === row.id}
                                  onClick={() => onMarkPaid(row.id, row.name)}>
                                  {t("recurring.markPaid")}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditRecordId(row.id);
                                  setEditAmountStr(String(row.amount));
                                }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {template && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openHistory(template.id)}>
                                  <History className="h-4 w-4" />
                                </Button>
                              )}
                            </motion.div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.section>
          )}

          {tab === "variable" && (
            <motion.section
              key="variable"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}>
              <Card className="mb-4 border-accent/30 bg-accent-muted">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-text-secondary">
                    {t("variable.total")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <motion.p
                    key={variableTotal}
                    initial={{ scale: 0.96, opacity: 0.6 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-2xl font-semibold tabular-nums">
                    {formatMxn(intlLocale, variableTotal)}
                  </motion.p>
                </CardContent>
              </Card>

              <CategoryPills
                categories={snapshot.categories}
                locale={intlLocale}
                value={categoryFilter}
                onChange={setCategoryFilter}
                allLabel={tc("all")}
              />

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <motion.div layout>
                  <Label>{t("variable.dateFrom")}</Label>
                  <Input
                    type="date"
                    className="mt-1"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </motion.div>
                <motion.div layout>
                  <Label>{t("variable.dateTo")}</Label>
                  <Input
                    type="date"
                    className="mt-1"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </motion.div>
              </div>

              <p className="mt-2 text-xs text-text-muted md:hidden">
                {t("variable.swipeHint")}
              </p>

              {filteredVariable.length === 0 ? (
                <p className="mt-8 text-center text-sm text-text-muted">
                  {t("variable.empty")}
                </p>
              ) : (
                <motion.div layout className="mt-6 space-y-6">
                  {variableByDay.map(([day, items]) => (
                    <motion.div key={day} layout>
                      <h3 className="mb-2 text-sm font-semibold text-text-secondary">
                        {formatDayHeading(intlLocale, day)}
                      </h3>
                      <div className="space-y-2">
                        {items.map((item) => {
                          const inner = (
                            <div className="flex items-center justify-between gap-3 border border-border-default bg-bg-card p-3 dark:border-border-default md:rounded-xl">
                              <div>
                                <p className="font-medium">
                                  {item.description}
                                </p>
                                <p className="text-xs text-text-muted">
                                  {item.categoryName}
                                  {item.subcategoryName
                                    ? ` · ${item.subcategoryName}`
                                    : ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold tabular-nums">
                                  {formatMxn(intlLocale, item.amount)}
                                </span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="hidden md:inline-flex"
                                  onClick={() =>
                                    confirmDeleteVariable(
                                      item.id,
                                      item.description,
                                    )
                                  }
                                  aria-label={tc("delete")}>
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </div>
                          );
                          return (
                            <div key={item.id} className="md:block">
                              <motion.div
                                className="hidden md:block"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}>
                                {inner}
                              </motion.div>
                              <div className="md:hidden">
                                <SwipeRow
                                  onDelete={() =>
                                    confirmDeleteVariable(
                                      item.id,
                                      item.description,
                                    )
                                  }
                                  deleteLabel={tc("delete")}>
                                  {inner}
                                </SwipeRow>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.section>
          )}

          {tab === "add" && (
            <motion.section
              key="add"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="max-w-lg">
              <div className="mb-4 inline-flex rounded-lg border p-0.5">
                {(["recurring", "variable"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setFormKind(k)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium",
                      formKind === k && "bg-primary text-primary-foreground",
                    )}>
                    {k === "recurring"
                      ? t("form.kindRecurring")
                      : t("form.kindVariable")}
                  </button>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {formKind === "recurring"
                      ? t("form.recurringTitle")
                      : t("form.variableTitle")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {formKind === "recurring" ? (
                    <div>
                      <Label>{t("form.name")}</Label>
                      <Input
                        className="mt-1"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                      />
                    </div>
                  ) : (
                    <>
                      <motion.div layout>
                        <Label>{t("form.description")}</Label>
                        <Input
                          className="mt-1"
                          value={formDesc}
                          onChange={(e) => setFormDesc(e.target.value)}
                        />
                      </motion.div>
                    </>
                  )}

                  <div>
                    <Label>{t("form.category")}</Label>
                    <Select
                      value={categoryId}
                      onValueChange={(v) => {
                        setFormCategoryId(v);
                        setFormSubcategoryId("");
                      }}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {snapshot.categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {intlLocale === "es" ? c.name_es : c.name_en}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {subsForCat.length > 0 && (
                    <div>
                      <Label>{t("form.subcategory")}</Label>
                      <Select
                        value={formSubcategoryId}
                        onValueChange={setFormSubcategoryId}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {subsForCat.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <button
                      type="button"
                      className="text-sm text-accent underline"
                      onClick={() => setShowNewSub((v) => !v)}>
                      {t("form.newSubcategory")}
                    </button>
                    {showNewSub && (
                      <div className="mt-2 flex gap-2">
                        <Input
                          placeholder={t("form.newSubcategoryPlaceholder")}
                          value={newSubName}
                          onChange={(e) => setNewSubName(e.target.value)}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={onCreateSub}
                          disabled={saving}>
                          {tc("save")}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label>{t("form.amount")}</Label>
                    <Input
                      inputMode="decimal"
                      className="mt-1"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                    />
                  </div>

                  {formKind === "recurring" ? (
                    <>
                      <div>
                        <Label>{t("form.paycheck")}</Label>
                        <Select
                          value={formPaycheck}
                          onValueChange={(v) =>
                            setFormPaycheck(v as "1" | "2")
                          }>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">
                              {t("quincena.q1")}
                            </SelectItem>
                            <SelectItem value="2">
                              {t("quincena.q2")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={formDueEvery}
                          onChange={(e) => setFormDueEvery(e.target.checked)}
                        />
                        {t("form.dueEveryPaycheck")}
                      </label>
                      {!formDueEvery && (
                        <div>
                          <Label>{t("form.dueDay")}</Label>
                          <Input
                            type="number"
                            min={1}
                            max={31}
                            className="mt-1"
                            value={formDueDay}
                            onChange={(e) => setFormDueDay(e.target.value)}
                          />
                        </div>
                      )}
                      <motion.div layout>
                        <Label>{t("form.account")}</Label>
                        {snapshot.accounts.length === 0 ? (
                          <p className="mt-1 text-sm text-amber-600">
                            {t("form.noAccounts")}
                          </p>
                        ) : (
                          <Select
                            value={formAccountId || snapshot.accounts[0]?.id}
                            onValueChange={setFormAccountId}>
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {snapshot.accounts.map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </motion.div>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={formActive}
                          onChange={(e) => setFormActive(e.target.checked)}
                        />
                        {t("form.active")}
                      </label>
                    </>
                  ) : (
                    <motion.div layout>
                      <Label>{t("form.date")}</Label>
                      <Input
                        type="date"
                        className="mt-1"
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                      />
                    </motion.div>
                  )}

                  <div>
                    <Label>{t("form.notes")}</Label>
                    <Input
                      className="mt-1"
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                    />
                  </div>

                  <Button
                    className="w-full"
                    disabled={saving || snapshot.accounts.length === 0}
                    onClick={onSubmitForm}>
                    {saving ? tc("saving") : tc("save")}
                  </Button>
                </CardContent>
              </Card>
            </motion.section>
          )}
        </AnimatePresence>

        <Dialog
          open={Boolean(editRecordId)}
          onOpenChange={() => setEditRecordId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("recurring.editAmount")}</DialogTitle>
            </DialogHeader>
            <Input
              type="number"
              inputMode="decimal"
              value={editAmountStr}
              onChange={(e) => setEditAmountStr(e.target.value)}
            />
            <Button onClick={onSaveEditAmount} disabled={saving}>
              {tc("save")}
            </Button>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(historyRecurringId)}
          onOpenChange={() => setHistoryRecurringId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("recurring.historyTitle")}</DialogTitle>
            </DialogHeader>
            {historyLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : historyRows.length === 0 ? (
              <p className="text-sm text-text-muted">
                {t("recurring.historyEmpty")}
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {historyRows.map((h) => (
                  <li
                    key={h.id}
                    className="flex justify-between border-b border-border-subtle py-2 dark:border-border-default">
                    <span>
                      {formatMonthYear(
                        intlLocale,
                        h.period_year,
                        h.period_month,
                      )}
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatMxn(intlLocale, h.amount)} · {h.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </DialogContent>
        </Dialog>
      </motion.div>
    </FinancePageShell>
  );
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
