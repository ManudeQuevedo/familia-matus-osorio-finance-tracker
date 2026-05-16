"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  CircleDot,
  Download,
  History,
  Pencil,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { CreatorBadge } from "@/components/finance/CreatorBadge";
import { FinanceContentHeaderActions } from "@/components/finance/FinanceContentHeaderActions";
import { FinanceHeaderSearchTrigger } from "@/components/finance/finance-header-search-trigger";
import { FinancePageShell } from "@/components/finance/FinancePageShell";
import { RowDeleteButton } from "@/components/finance/row-delete-button";
import { categoryLucideIcon } from "@/features/finance/category-lucide";
import {
  AddExpenseModal,
  type AddExpenseModalKind,
} from "@/features/finance/expenses/add-expense-modal";
import { ExpenseSpreadsheetImportDialog } from "@/features/finance/expenses/expense-spreadsheet-import-dialog";
import {
  deleteExpenseRecord,
  deleteRecurringExpenseTemplate,
  deleteVariableExpense,
  getRecurringExpenseHistory,
  markExpenseRecordPaid,
  updateExpenseRecordPaidAmount,
} from "@/lib/finance/actions";
import type { ExpenseFrequency } from "@/lib/finance/dashboard-queries";
import { uiQuincenaToDbPeriod } from "@/lib/finance/dashboard-queries";
import type { ExpensesSnapshot } from "@/lib/finance/expenses-queries";
import { expenseClassificationLucide } from "@/lib/finance/expense-type-lucide";
import {
  formatDayHeading,
  formatMxn,
  formatMonthYear,
  formatShortDate,
} from "@/lib/finance/format";
import {
  downloadExpensesWorkbook,
  exportStatusForSheet,
  type SheetExportRow,
} from "@/lib/import/process-spreadsheet";
import { toastConfirmDestructive, notify } from "@/lib/toast";
import { useEscape } from "@/lib/hooks/use-escape";
import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "@/i18n/navigation";

type Tab = "recurring" | "planned" | "unplanned" | "unexpected";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<Tab>("recurring");
  const [quincena, setQuincena] = useState<1 | 2>(1);
  const [freqFilter, setFreqFilter] = useState<ExpenseFrequency | "all">("all");
  const [typeChipFilter, setTypeChipFilter] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [addPreset, setAddPreset] = useState<AddExpenseModalKind | null>(null);
  const [addStep, setAddStep] = useState<1 | 2>(1);
  const [fromDashboard, setFromDashboard] = useState(false);

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

  useEffect(() => {
    const add = searchParams.get("add");
    const from = searchParams.get("from");
    if (!add) return;

    if (add === "unplanned") {
      setAddPreset("unplanned");
      setAddStep(2);
      setFromDashboard(from === "dashboard");
      setAddOpen(true);
      setTab("unplanned");
    } else if (add === "unexpected") {
      setAddPreset("unexpected");
      setAddStep(2);
      setFromDashboard(from === "dashboard");
      setAddOpen(true);
      setTab("unexpected");
    } else {
      setAddPreset(null);
      setAddStep(1);
      setFromDashboard(from === "dashboard");
      setAddOpen(true);
    }

    router.replace(pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  const dbPeriod = uiQuincenaToDbPeriod(quincena);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["finance-expenses"] });
    void queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] });
  }, [queryClient]);

  const exportMonthSpreadsheet = useCallback(() => {
    if (!snapshot) return;
    const intl = intlLocale === "es" ? "es" : "en";
    const templateByRecurring = new Map(
      snapshot.recurringTemplates.map((tpl) => [tpl.id, tpl]),
    );
    const rows: SheetExportRow[] = snapshot.expenseRecords
      .filter(
        (r) => r.expense_type === "recurring" || r.expense_type === "planned",
      )
      .map((r) => {
        const tpl = r.recurringExpenseId
          ? templateByRecurring.get(r.recurringExpenseId)
          : undefined;
        const due =
          tpl?.due_day != null
            ? String(tpl.due_day)
            : intl === "es"
              ? "Cada quincena"
              : "Every paycheck";
        return {
          Paycheck: r.paycheck_period,
          "Due Date": due,
          Expenses: r.name,
          Categories: r.categoryName,
          Amount: r.amount,
          Status: exportStatusForSheet(r.status, intl),
        };
      });
    if (!rows.length) {
      toast.message(t("importExport.exportEmpty"));
      return;
    }
    downloadExpensesWorkbook(rows, `gastos-${month}-${year}.xlsx`);
  }, [snapshot, intlLocale, year, month, t]);

  const totals = useMemo(() => {
    if (!snapshot) {
      return {
        recurring: 0,
        planned: 0,
        unplanned: 0,
        unexpected: 0,
        grand: 0,
      };
    }
    const recurring = snapshot.expenseRecords
      .filter((r) => r.expense_type === "recurring")
      .reduce((s, r) => s + r.amount, 0);
    const planned = snapshot.expenseRecords
      .filter((r) => r.expense_type === "planned")
      .reduce((s, r) => s + r.amount, 0);
    const unplanned = snapshot.variableExpenses
      .filter((v) => v.expense_type === "unplanned")
      .reduce((s, v) => s + v.amount, 0);
    const unexpected = snapshot.variableExpenses
      .filter((v) => v.expense_type === "unexpected")
      .reduce((s, v) => s + v.amount, 0);
    return {
      recurring,
      planned,
      unplanned,
      unexpected,
      grand: recurring + planned + unplanned + unexpected,
    };
  }, [snapshot]);

  const recurringRows = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.expenseRecords.filter(
      (r) => r.expense_type === "recurring",
    );
  }, [snapshot]);

  const filteredRecurring = useMemo(() => {
    return recurringRows.filter((r) => {
      const freq = r.frequency ?? "monthly";
      if (freqFilter !== "all" && freq !== freqFilter) return false;
      if (freq === "monthly") {
        if (r.paycheck_period !== dbPeriod) return false;
      }
      return true;
    });
  }, [recurringRows, freqFilter, dbPeriod]);

  const recurringTabTotal = filteredRecurring.reduce((s, r) => s + r.amount, 0);

  const plannedRows = useMemo(() => {
    if (!snapshot) return [];
    return [
      ...snapshot.expenseRecords.filter((r) => r.expense_type === "planned"),
    ].sort((a, b) => a.due_date.localeCompare(b.due_date));
  }, [snapshot]);

  const unplannedRows = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.variableExpenses.filter(
      (v) => v.expense_type === "unplanned",
    );
  }, [snapshot]);

  const unexpectedRows = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.variableExpenses.filter(
      (v) => v.expense_type === "unexpected",
    );
  }, [snapshot]);

  const filteredUnplanned = useMemo(() => {
    if (!typeChipFilter) return unplannedRows;
    return unplannedRows.filter((v) => v.typeId === typeChipFilter);
  }, [unplannedRows, typeChipFilter]);

  const unplannedGroups = useMemo(() => {
    const map = new Map<string, typeof filteredUnplanned>();
    for (const v of filteredUnplanned) {
      const key = v.typeName ?? t("unplanned.noType");
      const list = map.get(key) ?? [];
      list.push(v);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredUnplanned, t]);

  const unexpectedGroups = useMemo(() => {
    const map = new Map<string, typeof unexpectedRows>();
    for (const v of unexpectedRows) {
      const key = v.typeName ?? t("unexpected.noType");
      const list = map.get(key) ?? [];
      list.push(v);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [unexpectedRows, t]);

  const unplannedMonthTotal = filteredUnplanned.reduce(
    (s, v) => s + v.amount,
    0,
  );
  const unexpectedMonthTotal = unexpectedRows.reduce((s, v) => s + v.amount, 0);

  useEscape(() => setEditRecordId(null), Boolean(editRecordId));
  useEscape(() => setHistoryRecurringId(null), Boolean(historyRecurringId));

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

  const plannedTimingBadge = (dueDate: string, status: string) => {
    if (status === "paid") return null;
    const today = todayIsoDate();
    const week = addDaysIso(today, 7);
    if (dueDate < today) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          {t("planned.badges.overdue")}
        </Badge>
      );
    }
    if (dueDate === today) {
      return (
        <Badge
          variant="secondary"
          className="gap-1 border-accent/30 bg-accent/10">
          <CircleDot className="h-3 w-3" />
          {t("planned.badges.today")}
        </Badge>
      );
    }
    if (dueDate <= week) {
      return (
        <Badge variant="outline" className="gap-1">
          <CalendarClock className="h-3 w-3" />
          {t("planned.badges.upcoming")}
        </Badge>
      );
    }
    return null;
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
      title: tc("deleteNamed", { name }),
      description: tc("deleteCannotUndo"),
      duration: 5000,
      confirmLabel: tc("delete"),
      cancelLabel: tc("cancel"),
      onConfirm: () => runDeleteVariable(id, name),
    });
  };

  type PaycheckRowForDelete = {
    id: string;
    name: string;
    recurringExpenseId: string | null;
  };

  const runDeletePaycheckRow = async (row: PaycheckRowForDelete) => {
    const res = row.recurringExpenseId
      ? await deleteRecurringExpenseTemplate({
          locale,
          recurringExpenseId: row.recurringExpenseId,
        })
      : await deleteExpenseRecord({ locale, recordId: row.id });
    if (res.ok) {
      notify.expenses.deleteSuccess(row.name);
      invalidate();
    } else {
      notify.expenses.deleteError();
    }
  };

  const confirmDeletePaycheckRow = (row: PaycheckRowForDelete) => {
    toastConfirmDestructive({
      title: tc("deleteNamed", { name: row.name }),
      description: tc("deleteCannotUndo"),
      duration: 5000,
      confirmLabel: tc("delete"),
      cancelLabel: tc("cancel"),
      onConfirm: () => runDeletePaycheckRow(row),
    });
  };

  const freqLabel = (f: ExpenseFrequency | null | undefined) =>
    t(`freq.${f ?? "monthly"}` as "freq.monthly");

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
        <header className="relative mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("title")}
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              {formatMonthYear(intlLocale, year, month)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FinanceHeaderSearchTrigger />
            <Button
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={() => {
                setAddPreset(null);
                setAddStep(1);
                setFromDashboard(false);
                setAddOpen(true);
              }}>
              {t("addExpense")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="gap-1.5 text-text-secondary"
              onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 shrink-0" aria-hidden />
              {t("importExport.import")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="gap-1.5 text-text-secondary"
              onClick={exportMonthSpreadsheet}>
              <Download className="h-4 w-4 shrink-0" aria-hidden />
              {t("importExport.export")}
            </Button>
            <FinanceContentHeaderActions />
          </div>
        </header>

        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(
            [
              ["recurring", totals.recurring],
              ["planned", totals.planned],
              ["unplanned", totals.unplanned],
              ["unexpected", totals.unexpected],
            ] as const
          ).map(([key, val]) => (
            <Card key={key} className="border-border-default bg-bg-card">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-text-muted">
                  {t(`summary.${key}`)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold tabular-nums">
                  {formatMxn(intlLocale, val)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mb-6 border-accent/25 bg-accent-muted/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-2 py-4">
            <span className="text-sm font-medium text-text-secondary">
              {t("summary.grand")}
            </span>
            <span className="text-xl font-bold tabular-nums text-accent">
              {formatMxn(intlLocale, totals.grand)}
            </span>
          </CardContent>
        </Card>

        <motion.div
          layout
          className="mb-6 inline-flex w-full flex-wrap rounded-lg border border-border-default bg-bg-card p-0.5 dark:border-border-default">
          {(["recurring", "planned", "unplanned", "unexpected"] as const).map(
            (key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-xs font-medium transition sm:flex-none sm:px-4 sm:text-sm",
                  tab === key
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-text-secondary dark:text-text-muted",
                )}>
                {t(`tabs.${key}`)}
              </button>
            ),
          )}
        </motion.div>

        <AnimatePresence mode="wait">
          {tab === "recurring" && (
            <motion.section
              key="recurring"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.25 }}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex rounded-lg border border-border-default bg-bg-card p-0.5 dark:border-border-default">
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
                </div>
                <p className="text-sm font-semibold tabular-nums text-accent">
                  {t("quincena.total")}:{" "}
                  {formatMxn(intlLocale, recurringTabTotal)}
                </p>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                <span className="text-xs font-medium text-text-muted">
                  {t("recurring.freqFilter")}:
                </span>
                {(
                  ["all", "monthly", "bimonthly", "annual", "unique"] as const
                ).map((fk) => (
                  <button
                    key={fk}
                    type="button"
                    onClick={() => setFreqFilter(fk)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium",
                      freqFilter === fk
                        ? "border-accent bg-accent-muted text-accent"
                        : "border-border-default bg-bg-card",
                    )}>
                    {fk === "all" ? tc("all") : freqLabel(fk)}
                  </button>
                ))}
              </div>

              {isFetching && !data ? (
                <div className="space-y-2">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : filteredRecurring.length === 0 ? (
                <p className="mt-8 text-center text-sm text-text-muted">
                  {t("recurring.empty")}
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="hidden gap-2 rounded-lg bg-bg-card-nested px-3 py-2 text-xs font-medium text-text-secondary md:grid md:grid-cols-[1.3fr_1fr_0.7fr_0.7fr_0.8fr_0.8fr_auto] dark:text-text-muted">
                    <span>{t("recurring.columns.name")}</span>
                    <span>{t("recurring.columns.subcategory")}</span>
                    <span>{t("recurring.columns.freq")}</span>
                    <span>{t("recurring.columns.due")}</span>
                    <span>{t("recurring.columns.amount")}</span>
                    <span>{t("recurring.columns.account")}</span>
                    <span>{t("recurring.columns.status")}</span>
                  </div>
                  {filteredRecurring.map((row, i) => {
                    const template =
                      row.recurringExpenseId != null
                        ? snapshot.recurringTemplates.find(
                            (rt) => rt.id === row.recurringExpenseId,
                          )
                        : undefined;
                    const freq =
                      row.frequency ?? template?.frequency ?? "monthly";
                    return (
                      <motion.div
                        key={row.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}>
                        <Card className="group overflow-hidden">
                          <CardContent className="grid gap-3 p-4 md:grid-cols-[1.3fr_1fr_0.7fr_0.7fr_0.8fr_0.8fr_auto] md:items-center md:gap-2">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <CreatorBadge letter={row.creatorInitial} />
                                <p className="font-medium">{row.name}</p>
                              </div>
                              <p className="text-xs text-text-muted md:hidden">
                                {row.subcategoryName}
                              </p>
                            </div>
                            <span className="hidden text-sm md:block">
                              {row.subcategoryName}
                            </span>
                            <Badge
                              variant="outline"
                              className="w-fit text-[10px]">
                              {freqLabel(freq)}
                            </Badge>
                            <span className="text-sm tabular-nums">
                              {formatShortDate(intlLocale, row.due_date)}
                            </span>
                            <span className="font-semibold tabular-nums">
                              {formatMxn(intlLocale, row.amount)}
                            </span>
                            <span className="text-sm text-text-secondary">
                              {row.accountName}
                            </span>
                            <div className="flex flex-wrap items-center gap-2">
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
                              <RowDeleteButton
                                ariaLabel={tc("delete")}
                                onClick={() =>
                                  confirmDeletePaycheckRow({
                                    id: row.id,
                                    name: row.name,
                                    recurringExpenseId: row.recurringExpenseId,
                                  })
                                }
                              />
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.section>
          )}

          {tab === "planned" && (
            <motion.section
              key="planned"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}>
              {plannedRows.length === 0 ? (
                <p className="mt-8 text-center text-sm text-text-muted">
                  {t("planned.empty")}
                </p>
              ) : (
                <div className="space-y-2">
                  {plannedRows.map((row) => (
                    <Card key={row.id} className="group overflow-hidden">
                      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <CreatorBadge letter={row.creatorInitial} />
                            <p className="font-medium">{row.name}</p>
                            {plannedTimingBadge(row.due_date, row.status)}
                          </div>
                          <p className="text-xs text-text-muted">
                            {row.categoryName} · {row.subcategoryName}
                          </p>
                          <p className="mt-1 text-xs text-text-muted">
                            {t("planned.estimated")}:{" "}
                            {formatMxn(intlLocale, row.amount)}
                            {row.status === "paid"
                              ? ` · ${t("planned.paidAmount")}: ${formatMxn(intlLocale, row.amount)}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          {statusBadge(row.status, row.due_date)}
                          {row.status !== "paid" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={payingId === row.id}
                              onClick={() => onMarkPaid(row.id, row.name)}>
                              {t("recurring.markPaid")}
                            </Button>
                          ) : null}
                          <RowDeleteButton
                            ariaLabel={tc("delete")}
                            onClick={() =>
                              confirmDeletePaycheckRow({
                                id: row.id,
                                name: row.name,
                                recurringExpenseId: row.recurringExpenseId,
                              })
                            }
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </motion.section>
          )}

          {tab === "unplanned" && (
            <motion.section
              key="unplanned"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}>
              <Card className="mb-4 border-accent/30 bg-accent-muted">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-text-secondary">
                    {t("unplanned.monthTotal")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatMxn(intlLocale, unplannedMonthTotal)}
                  </p>
                </CardContent>
              </Card>

              <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                <button
                  type="button"
                  onClick={() => setTypeChipFilter(null)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1 text-xs font-medium",
                    typeChipFilter === null
                      ? "border-accent bg-primary text-primary-foreground"
                      : "border-border-default bg-bg-card",
                  )}>
                  {tc("all")}
                </button>
                {snapshot.unplannedTypes.map((ty) => {
                  const Icon = expenseClassificationLucide(ty.icon);
                  const active = typeChipFilter === ty.id;
                  const sum = unplannedRows
                    .filter((v) => v.typeId === ty.id)
                    .reduce((s, v) => s + v.amount, 0);
                  return (
                    <button
                      key={ty.id}
                      type="button"
                      onClick={() => setTypeChipFilter(ty.id)}
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                        active
                          ? "border-accent bg-accent-muted text-accent"
                          : "border-border-default bg-bg-card",
                      )}>
                      <Icon className="h-3.5 w-3.5" />
                      {ty.name}
                      <span className="tabular-nums text-text-muted">
                        {formatMxn(intlLocale, sum)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {filteredUnplanned.length === 0 ? (
                <p className="mt-8 text-center text-sm text-text-muted">
                  {t("unplanned.empty")}
                </p>
              ) : (
                <div className="space-y-8">
                  {unplannedGroups.map(([label, items]) => (
                    <div key={label}>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">{label}</h3>
                        <span className="text-xs tabular-nums text-text-muted">
                          {formatMxn(
                            intlLocale,
                            items.reduce((s, x) => s + x.amount, 0),
                          )}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {[...items]
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map((item) => {
                            const inner = (
                              <div className="group flex items-center justify-between gap-3 border border-border-default bg-bg-card p-3 dark:border-border-default md:rounded-xl">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <CreatorBadge
                                      letter={item.creatorInitial}
                                    />
                                    <p className="font-medium">
                                      {item.description}
                                    </p>
                                  </div>
                                  <p className="text-xs text-text-muted">
                                    {formatDayHeading(intlLocale, item.date)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold tabular-nums">
                                    {formatMxn(intlLocale, item.amount)}
                                  </span>
                                  <RowDeleteButton
                                    ariaLabel={tc("delete")}
                                    onClick={() =>
                                      confirmDeleteVariable(
                                        item.id,
                                        item.description,
                                      )
                                    }
                                  />
                                </div>
                              </div>
                            );
                            return <div key={item.id}>{inner}</div>;
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.section>
          )}

          {tab === "unexpected" && (
            <motion.section
              key="unexpected"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}>
              <Card className="mb-4 border-border-default bg-bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-text-secondary">
                    {t("unexpected.monthTotal")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatMxn(intlLocale, unexpectedMonthTotal)}
                  </p>
                </CardContent>
              </Card>

              {unexpectedRows.length === 0 ? (
                <p className="mt-8 text-center text-sm text-text-muted">
                  {t("unexpected.empty")}
                </p>
              ) : (
                <div className="space-y-8">
                  {unexpectedGroups.map(([label, items]) => (
                    <div key={label}>
                      <h3 className="mb-2 text-sm font-semibold">{label}</h3>
                      <div className="space-y-2">
                        {[...items]
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map((item) => {
                            const Icon = expenseClassificationLucide(
                              item.typeIcon,
                            );
                            const inner = (
                              <div className="group flex items-center justify-between gap-3 border border-border-default bg-bg-card p-3 dark:border-border-default md:rounded-xl">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge
                                      variant="outline"
                                      className="gap-1 border-accent/30 bg-accent/5">
                                      <Icon className="h-3 w-3" />
                                      {item.typeName ?? label}
                                    </Badge>
                                    {item.permanentSolution ? (
                                      <span
                                        title={
                                          item.permanentSolutionNote ?? ""
                                        }>
                                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                      </span>
                                    ) : null}
                                    <CreatorBadge
                                      letter={item.creatorInitial}
                                    />
                                  </div>
                                  <p className="mt-1 font-medium">
                                    {item.description}
                                  </p>
                                  <p className="text-xs text-text-muted">
                                    {formatDayHeading(intlLocale, item.date)}
                                  </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  <span className="font-semibold tabular-nums">
                                    {formatMxn(intlLocale, item.amount)}
                                  </span>
                                  <RowDeleteButton
                                    ariaLabel={tc("delete")}
                                    onClick={() =>
                                      confirmDeleteVariable(
                                        item.id,
                                        item.description,
                                      )
                                    }
                                  />
                                </div>
                              </div>
                            );
                            return <div key={item.id}>{inner}</div>;
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        <AddExpenseModal
          open={addOpen}
          onOpenChange={(o) => {
            setAddOpen(o);
            if (!o) {
              setAddPreset(null);
              setAddStep(1);
              setFromDashboard(false);
            }
          }}
          snapshot={snapshot}
          year={year}
          month={month}
          onInvalidate={invalidate}
          initialKind={addPreset}
          startAtStep={addStep}
          returnToDashboard={fromDashboard}
        />

        <ExpenseSpreadsheetImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          snapshot={snapshot}
          year={year}
          month={month}
          onImported={invalidate}
        />

        <Dialog
          open={Boolean(editRecordId)}
          onOpenChange={() => setEditRecordId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("recurring.editAmount")}</DialogTitle>
              <DialogDescription className="sr-only">
                {t("recurring.editAmount")}
              </DialogDescription>
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
              <DialogDescription className="sr-only">
                {t("recurring.historyTitle")}
              </DialogDescription>
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
