"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Calendar, RefreshCw, Target, Zap } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RowDeleteButton } from "@/components/finance/row-delete-button";
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
import { categoryLucideIcon } from "@/features/finance/category-lucide";
import {
  createCustomExpenseClassification,
  createQuickVariableExpense,
  createRecurringExpense,
  createSubcategory,
  deleteCustomExpenseType,
} from "@/lib/finance/actions";
import { uiQuincenaToDbPeriod } from "@/lib/finance/dashboard-queries";
import type { ExpenseFrequency } from "@/lib/finance/dashboard-queries";
import { expenseClassificationLucide } from "@/lib/finance/expense-type-lucide";
import type { ExpensesSnapshot } from "@/lib/finance/expenses-queries";
import { notify, toastConfirmDestructive } from "@/lib/toast";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type AddExpenseModalKind =
  | "recurring"
  | "planned"
  | "unplanned"
  | "unexpected";

type AddExpenseModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: ExpensesSnapshot;
  year: number;
  month: number;
  onInvalidate: () => void;
  /** When opening from FAB deep-link */
  initialKind?: AddExpenseModalKind | null;
  startAtStep?: 1 | 2;
  returnToDashboard?: boolean;
};

function parsePaycheckFromDay(day: number): 1 | 2 {
  return day <= 15 ? 2 : 1;
}

export function AddExpenseModal({
  open,
  onOpenChange,
  snapshot,
  year,
  month,
  onInvalidate,
  initialKind = null,
  startAtStep = 1,
  returnToDashboard = false,
}: AddExpenseModalProps) {
  const t = useTranslations("Finance.expenses.addModal");
  const tc = useTranslations("Finance.common");
  const intlLocale = useLocale();
  const locale = intlLocale === "es" ? "es" : "en";
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedKind, setSelectedKind] = useState<AddExpenseModalKind | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const prevOpenRef = useRef(false);

  const defaultCategoryId = snapshot.categories[0]?.id ?? "";

  const resetTransient = useCallback(() => {
    setStep(1);
    setSelectedKind(null);
  }, []);

  useEffect(() => {
    if (!open) {
      prevOpenRef.current = false;
      return;
    }
    if (prevOpenRef.current) return;
    prevOpenRef.current = true;
    if (initialKind && startAtStep === 2) {
      setSelectedKind(initialKind);
      setStep(2);
    } else {
      setStep(1);
      setSelectedKind(null);
    }
  }, [open, initialKind, startAtStep]);

  const close = (next: boolean) => {
    if (!next) resetTransient();
    onOpenChange(next);
  };

  const goPickKind = (kind: AddExpenseModalKind) => {
    setSelectedKind(kind);
    setStep(2);
  };

  const KindIcon =
    selectedKind === "recurring"
      ? RefreshCw
      : selectedKind === "planned"
        ? Calendar
        : selectedKind === "unplanned"
          ? Target
          : Zap;

  // --- shared form bits ---
  const [recName, setRecName] = useState("");
  const [recCat, setRecCat] = useState(defaultCategoryId);
  const [recSub, setRecSub] = useState("");
  const [recAmount, setRecAmount] = useState("");
  const [recFreq, setRecFreq] = useState<ExpenseFrequency>("monthly");
  const [recPayUi, setRecPayUi] = useState<"1" | "2" | "both">("1");
  const [recDueDay, setRecDueDay] = useState("15");
  const [recDueEvery, setRecDueEvery] = useState(false);
  const [recAccount, setRecAccount] = useState(snapshot.accounts[0]?.id ?? "");
  const [recNotes, setRecNotes] = useState("");

  const [planName, setPlanName] = useState("");
  const [planCat, setPlanCat] = useState(defaultCategoryId);
  const [planSub, setPlanSub] = useState("");
  const [planAmount, setPlanAmount] = useState("");
  const [planDate, setPlanDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [planRepeats, setPlanRepeats] = useState(false);
  const [planRepeatFreq, setPlanRepeatFreq] = useState<"annual" | "bimonthly">(
    "annual",
  );
  const [planAccount, setPlanAccount] = useState(
    snapshot.accounts[0]?.id ?? "",
  );
  const [planNotes, setPlanNotes] = useState("");

  const [unTypeId, setUnTypeId] = useState<string | null>(
    snapshot.unplannedTypes[0]?.id ?? null,
  );
  const [unDesc, setUnDesc] = useState("");
  const [unAmount, setUnAmount] = useState("");
  const [unDate, setUnDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [unNotes, setUnNotes] = useState("");
  const [unNewTypeOpen, setUnNewTypeOpen] = useState(false);
  const [unNewTypeName, setUnNewTypeName] = useState("");

  const [uxTypeId, setUxTypeId] = useState<string | null>(
    snapshot.unexpectedTypes[0]?.id ?? null,
  );
  const [uxDesc, setUxDesc] = useState("");
  const [uxAmount, setUxAmount] = useState("");
  const [uxDate, setUxDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [uxPermanent, setUxPermanent] = useState(false);
  const [uxPermanentNote, setUxPermanentNote] = useState("");
  const [uxNotes, setUxNotes] = useState("");
  const [uxNewTypeOpen, setUxNewTypeOpen] = useState(false);
  const [uxNewTypeName, setUxNewTypeName] = useState("");

  const [newSubOpen, setNewSubOpen] = useState(false);
  const [newSubName, setNewSubName] = useState("");

  const confirmDeleteExpenseType = (
    kind: "unplanned" | "unexpected",
    id: string,
    name: string,
  ) => {
    toastConfirmDestructive({
      title: tc("deleteNamed", { name }),
      description: tc("deleteCannotUndo"),
      duration: 5000,
      confirmLabel: tc("delete"),
      cancelLabel: tc("cancel"),
      onConfirm: async () => {
        const res = await deleteCustomExpenseType({ locale, kind, id });
        if (res.ok) {
          notify.expenseTypes.deleteSuccess(name);
          if (kind === "unplanned" && unTypeId === id) {
            const next = snapshot.unplannedTypes.filter((t) => t.id !== id);
            setUnTypeId(next[0]?.id ?? null);
          }
          if (kind === "unexpected" && uxTypeId === id) {
            const next = snapshot.unexpectedTypes.filter((t) => t.id !== id);
            setUxTypeId(next[0]?.id ?? null);
          }
          onInvalidate();
        } else {
          notify.expenseTypes.deleteError();
        }
      },
    });
  };

  const subsRec = useMemo(
    () => snapshot.subcategories.filter((s) => s.category_id === recCat),
    [snapshot.subcategories, recCat],
  );
  const subsPlan = useMemo(
    () => snapshot.subcategories.filter((s) => s.category_id === planCat),
    [snapshot.subcategories, planCat],
  );

  useEffect(() => {
    if (!open) return;
    setRecCat(defaultCategoryId);
    setPlanCat(defaultCategoryId);
    setRecAccount(snapshot.accounts[0]?.id ?? "");
    setPlanAccount(snapshot.accounts[0]?.id ?? "");
  }, [open, defaultCategoryId, snapshot.accounts]);

  const onCreateSub = async (categoryId: string, which: "rec" | "plan") => {
    if (!categoryId || !newSubName.trim()) return;
    setSaving(true);
    const res = await createSubcategory({
      locale,
      categoryId,
      name: newSubName.trim(),
    });
    setSaving(false);
    if (res.ok && res.subcategory) {
      if (which === "rec") setRecSub(res.subcategory.id);
      else setPlanSub(res.subcategory.id);
      setNewSubOpen(false);
      setNewSubName("");
      onInvalidate();
      notify.generic.saved();
    } else {
      notify.generic.unexpectedError();
    }
  };

  const addUnplannedType = async () => {
    if (!unNewTypeName.trim()) return;
    setSaving(true);
    const res = await createCustomExpenseClassification({
      locale,
      kind: "unplanned",
      name: unNewTypeName.trim(),
    });
    setSaving(false);
    if (res.ok) {
      setUnTypeId(res.id);
      setUnNewTypeOpen(false);
      setUnNewTypeName("");
      onInvalidate();
      notify.generic.saved();
    } else {
      notify.generic.unexpectedError();
    }
  };

  const addUnexpectedType = async () => {
    if (!uxNewTypeName.trim()) return;
    setSaving(true);
    const res = await createCustomExpenseClassification({
      locale,
      kind: "unexpected",
      name: uxNewTypeName.trim(),
    });
    setSaving(false);
    if (res.ok) {
      setUxTypeId(res.id);
      setUxNewTypeOpen(false);
      setUxNewTypeName("");
      onInvalidate();
      notify.generic.saved();
    } else {
      notify.generic.unexpectedError();
    }
  };

  const finishSuccess = (label: string) => {
    notify.expenses.addSuccess(label);
    onInvalidate();
    close(false);
    resetTransient();
    if (returnToDashboard) {
      router.push("/dashboard");
    }
  };

  const onSubmitRecurring = async () => {
    const amount = Number.parseFloat(recAmount.replace(",", "."));
    if (!recName.trim() || !Number.isFinite(amount) || amount < 0 || !recSub) {
      return;
    }
    const accountId = recAccount || snapshot.accounts[0]?.id;
    if (!accountId) return;

    setSaving(true);
    const paycheckBoth = recFreq === "monthly" && recPayUi === "both";
    const dueNum = recDueEvery ? 15 : Number.parseInt(recDueDay, 10) || 15;
    const dbPeriodSingle =
      recFreq === "monthly" && !paycheckBoth
        ? uiQuincenaToDbPeriod(Number(recPayUi) as 1 | 2)
        : parsePaycheckFromDay(dueNum);

    const res = await createRecurringExpense({
      locale,
      name: recName.trim(),
      subcategoryId: recSub,
      accountId,
      amount,
      paycheckPeriod: dbPeriodSingle,
      dueDay: recDueEvery ? null : dueNum,
      isActive: true,
      notes: recNotes || undefined,
      year,
      month,
      frequency: recFreq,
      templateKind: "recurring",
      paycheckBoth,
    });
    setSaving(false);
    if (res.ok) finishSuccess(recName.trim());
    else notify.expenses.addError();
  };

  const onSubmitPlanned = async () => {
    const amount = Number.parseFloat(planAmount.replace(",", "."));
    if (!planName.trim() || !Number.isFinite(amount) || amount < 0 || !planSub)
      return;
    const accountId = planAccount || snapshot.accounts[0]?.id;
    if (!accountId) return;

    const d = Number.parseInt(planDate.slice(8, 10), 10);
    const y = Number.parseInt(planDate.slice(0, 4), 10);
    const m = Number.parseInt(planDate.slice(5, 7), 10);
    const paycheckPeriod = parsePaycheckFromDay(d);

    const frequency: ExpenseFrequency = planRepeats ? planRepeatFreq : "unique";

    setSaving(true);
    const res = await createRecurringExpense({
      locale,
      name: planName.trim(),
      subcategoryId: planSub,
      accountId,
      amount,
      paycheckPeriod,
      dueDay: d,
      isActive: true,
      notes: planNotes || undefined,
      year: y,
      month: m,
      frequency,
      templateKind: "planned",
    });
    setSaving(false);
    if (res.ok) finishSuccess(planName.trim());
    else notify.expenses.addError();
  };

  const onSubmitUnplanned = async () => {
    const amount = Number.parseFloat(unAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount < 0 || !defaultCategoryId) return;
    const desc =
      [unDesc.trim(), unNotes.trim() ? `${t("notes")}: ${unNotes.trim()}` : ""]
        .filter(Boolean)
        .join(" · ") || " ";
    setSaving(true);
    const res = await createQuickVariableExpense({
      locale,
      amount,
      categoryId: defaultCategoryId,
      subcategoryId: null,
      description: desc,
      date: unDate,
      expense_type: "unplanned",
      type_id: unTypeId,
    });
    setSaving(false);
    if (res.ok) finishSuccess(desc.slice(0, 40));
    else notify.expenses.addError();
  };

  const onSubmitUnexpectedFixed = async () => {
    const amount = Number.parseFloat(uxAmount.replace(",", "."));
    if (
      !uxDesc.trim() ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      !defaultCategoryId
    )
      return;
    setSaving(true);
    let description = uxDesc.trim();
    if (uxNotes.trim()) {
      description = `${description} · ${t("notes")}: ${uxNotes.trim()}`;
    }
    const res = await createQuickVariableExpense({
      locale,
      amount,
      categoryId: defaultCategoryId,
      subcategoryId: null,
      description,
      date: uxDate,
      expense_type: "unexpected",
      type_id: uxTypeId,
      permanent_solution: uxPermanent,
      permanent_solution_note: uxPermanent
        ? uxPermanentNote.trim() || null
        : null,
    });
    setSaving(false);
    if (res.ok) finishSuccess(uxDesc.trim());
    else notify.expenses.addError();
  };

  const stepTransition = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
    transition: { duration: 0.2 },
  };

  const kindCards: {
    kind: AddExpenseModalKind;
    icon: typeof RefreshCw;
  }[] = [
    { kind: "recurring", icon: RefreshCw },
    { kind: "planned", icon: Calendar },
    { kind: "unplanned", icon: Target },
    { kind: "unexpected", icon: Zap },
  ];

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        className={cn(
          "max-w-lg",
          step === 1 && "max-h-[min(90dvh,560px)] overflow-hidden",
        )}
        aria-describedby={undefined}>
        <DialogDescription className="sr-only">
          {t("ariaDescription")}
        </DialogDescription>
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div key="s1" {...stepTransition}>
              <DialogHeader className="space-y-1 text-center sm:text-center">
                <DialogTitle className="text-xl">{t("step1Title")}</DialogTitle>
              </DialogHeader>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {kindCards.map(({ kind, icon: Icon }) => {
                  const active = selectedKind === kind;
                  return (
                    <motion.button
                      key={kind}
                      type="button"
                      layout
                      whileTap={{ scale: 0.98 }}
                      onClick={() => goPickKind(kind)}
                      className={cn(
                        "rounded-xl border bg-bg-card p-5 text-left transition-colors",
                        active
                          ? "border-2 border-accent bg-accent/10"
                          : "border-border-default hover:border-accent hover:bg-accent/5",
                      )}>
                      <Icon
                        className="h-6 w-6 text-accent"
                        strokeWidth={2}
                        aria-hidden
                      />
                      <p className="mt-3 font-semibold">
                        {t(`kinds.${kind}.title`)}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        {t(`kinds.${kind}.desc`)}
                      </p>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <motion.div key="s2" {...stepTransition}>
              <DialogHeader className="flex flex-row flex-wrap items-center gap-2 space-y-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  aria-label={t("back")}
                  onClick={() => {
                    if (initialKind && startAtStep === 2) {
                      close(false);
                    } else {
                      setStep(1);
                    }
                  }}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <DialogTitle className="text-lg">
                    {t("step2Title", {
                      type: selectedKind
                        ? t(`kinds.${selectedKind}.short`)
                        : "",
                    })}
                  </DialogTitle>
                  {selectedKind ? (
                    <Badge
                      variant="secondary"
                      className="border border-accent/25 bg-accent/15 text-accent">
                      <KindIcon className="mr-1 h-3 w-3" aria-hidden />
                      {t(`kinds.${selectedKind}.short`)}
                    </Badge>
                  ) : null}
                </div>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                {selectedKind === "recurring" ? (
                  <>
                    <div>
                      <Label>{t("recurring.name")}</Label>
                      <Input
                        className="mt-1"
                        value={recName}
                        onChange={(e) => setRecName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>{t("recurring.category")}</Label>
                      <Select
                        value={recCat}
                        onValueChange={(v) => {
                          setRecCat(v);
                          setRecSub("");
                        }}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {snapshot.categories.map((c) => {
                            const Ico = categoryLucideIcon(c.icon);
                            return (
                              <SelectItem key={c.id} value={c.id}>
                                <span className="flex items-center gap-2">
                                  <Ico
                                    className="h-4 w-4"
                                    style={{ color: c.color }}
                                  />
                                  {intlLocale === "es" ? c.name_es : c.name_en}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    {subsRec.length > 0 ? (
                      <div>
                        <Label>{t("recurring.subcategory")}</Label>
                        <Select value={recSub} onValueChange={setRecSub}>
                          <SelectTrigger className="mt-1">
                            <SelectValue
                              placeholder={t("recurring.subcategory")}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {subsRec.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="text-sm text-accent underline"
                      onClick={() => setNewSubOpen((v) => !v)}>
                      {t("newSubcategory")}
                    </button>
                    {newSubOpen ? (
                      <div className="flex gap-2">
                        <Input
                          value={newSubName}
                          onChange={(e) => setNewSubName(e.target.value)}
                          placeholder={t("newSubcategoryPh")}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onCreateSub(recCat, "rec")}
                          disabled={saving}>
                          {tc("save")}
                        </Button>
                      </div>
                    ) : null}
                    <div>
                      <Label>{t("amount")}</Label>
                      <Input
                        inputMode="decimal"
                        className="mt-1"
                        value={recAmount}
                        onChange={(e) => setRecAmount(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>{t("recurring.frequency")}</Label>
                      <Select
                        value={recFreq}
                        onValueChange={(v) =>
                          setRecFreq(v as ExpenseFrequency)
                        }>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">
                            {t("freq.monthly")}
                          </SelectItem>
                          <SelectItem value="bimonthly">
                            {t("freq.bimonthly")}
                          </SelectItem>
                          <SelectItem value="annual">
                            {t("freq.annual")}
                          </SelectItem>
                          <SelectItem value="unique">
                            {t("freq.unique")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {recFreq === "monthly" ? (
                      <div>
                        <Label>{t("recurring.paycheck")}</Label>
                        <Select
                          value={recPayUi}
                          onValueChange={(v) =>
                            setRecPayUi(v as "1" | "2" | "both")
                          }>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">
                              {t("paycheck.q1")}
                            </SelectItem>
                            <SelectItem value="2">
                              {t("paycheck.q2")}
                            </SelectItem>
                            <SelectItem value="both">
                              {t("paycheck.both")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={recDueEvery}
                        onChange={(e) => setRecDueEvery(e.target.checked)}
                      />
                      {t("recurring.dueEvery")}
                    </label>
                    {!recDueEvery ? (
                      <div>
                        <Label>{t("recurring.dueDay")}</Label>
                        <Input
                          type="number"
                          min={1}
                          max={31}
                          className="mt-1"
                          value={recDueDay}
                          onChange={(e) => setRecDueDay(e.target.value)}
                        />
                      </div>
                    ) : null}
                    <div>
                      <Label>{t("recurring.account")}</Label>
                      <Select value={recAccount} onValueChange={setRecAccount}>
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
                    </div>
                    <div>
                      <Label>{t("notes")}</Label>
                      <textarea
                        className="border-input bg-background ring-offset-background mt-1 flex min-h-[72px] w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={recNotes}
                        onChange={(e) => setRecNotes(e.target.value)}
                      />
                    </div>
                    <Button
                      className="w-full"
                      disabled={
                        saving ||
                        !recName.trim() ||
                        !recSub ||
                        snapshot.accounts.length === 0
                      }
                      onClick={() => void onSubmitRecurring()}>
                      {saving ? tc("saving") : tc("save")}
                    </Button>
                  </>
                ) : null}

                {selectedKind === "planned" ? (
                  <>
                    <div>
                      <Label>{t("planned.name")}</Label>
                      <Input
                        className="mt-1"
                        value={planName}
                        onChange={(e) => setPlanName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>{t("planned.category")}</Label>
                      <Select
                        value={planCat}
                        onValueChange={(v) => {
                          setPlanCat(v);
                          setPlanSub("");
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
                    {subsPlan.length > 0 ? (
                      <div>
                        <Label>{t("planned.subcategory")}</Label>
                        <Select value={planSub} onValueChange={setPlanSub}>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {subsPlan.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="text-sm text-accent underline"
                      onClick={() => setNewSubOpen((v) => !v)}>
                      {t("newSubcategory")}
                    </button>
                    {newSubOpen ? (
                      <div className="flex gap-2">
                        <Input
                          value={newSubName}
                          onChange={(e) => setNewSubName(e.target.value)}
                          placeholder={t("newSubcategoryPh")}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onCreateSub(planCat, "plan")}
                          disabled={saving}>
                          {tc("save")}
                        </Button>
                      </div>
                    ) : null}
                    <div>
                      <Label>{t("amount")}</Label>
                      <Input
                        inputMode="decimal"
                        className="mt-1"
                        value={planAmount}
                        onChange={(e) => setPlanAmount(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>{t("planned.plannedDate")}</Label>
                      <Input
                        type="date"
                        className="mt-1"
                        value={planDate}
                        onChange={(e) => setPlanDate(e.target.value)}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={planRepeats}
                        onChange={(e) => setPlanRepeats(e.target.checked)}
                      />
                      {t("planned.repeats")}
                    </label>
                    {planRepeats ? (
                      <div>
                        <Label>{t("planned.repeatFreq")}</Label>
                        <Select
                          value={planRepeatFreq}
                          onValueChange={(v) =>
                            setPlanRepeatFreq(v as "annual" | "bimonthly")
                          }>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="annual">
                              {t("freq.annual")}
                            </SelectItem>
                            <SelectItem value="bimonthly">
                              {t("freq.bimonthly")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                    <div>
                      <Label>{t("planned.account")}</Label>
                      <Select
                        value={planAccount}
                        onValueChange={setPlanAccount}>
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
                    </div>
                    <div>
                      <Label>{t("notes")}</Label>
                      <textarea
                        className="border-input bg-background ring-offset-background mt-1 flex min-h-[72px] w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={planNotes}
                        onChange={(e) => setPlanNotes(e.target.value)}
                      />
                    </div>
                    <Button
                      className="w-full"
                      disabled={
                        saving ||
                        !planName.trim() ||
                        !planSub ||
                        snapshot.accounts.length === 0
                      }
                      onClick={() => void onSubmitPlanned()}>
                      {saving ? tc("saving") : tc("save")}
                    </Button>
                  </>
                ) : null}

                {selectedKind === "unplanned" ? (
                  <>
                    <div>
                      <Label>{t("unplanned.type")}</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {snapshot.unplannedTypes.map((ty) => {
                          const Ico = expenseClassificationLucide(ty.icon);
                          const on = unTypeId === ty.id;
                          return (
                            <div
                              key={ty.id}
                              className="group inline-flex items-center overflow-hidden rounded-full border border-border-default bg-bg-card">
                              <button
                                type="button"
                                onClick={() => setUnTypeId(ty.id)}
                                className={cn(
                                  "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium",
                                  on
                                    ? "bg-accent/15 text-accent"
                                    : "bg-transparent",
                                )}>
                                <Ico className="h-3.5 w-3.5" />
                                {ty.name}
                              </button>
                              {!ty.is_system ? (
                                <RowDeleteButton
                                  className="rounded-none border-l border-border-default"
                                  ariaLabel={tc("delete")}
                                  onClick={() =>
                                    confirmDeleteExpenseType(
                                      "unplanned",
                                      ty.id,
                                      ty.name,
                                    )
                                  }
                                />
                              ) : null}
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setUnNewTypeOpen(true)}
                          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border-default px-3 py-1.5 text-xs font-medium text-accent">
                          + {t("addType")}
                        </button>
                      </div>
                      {unNewTypeOpen ? (
                        <div className="mt-2 flex gap-2">
                          <Input
                            value={unNewTypeName}
                            onChange={(e) => setUnNewTypeName(e.target.value)}
                            placeholder={t("newTypePh")}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void addUnplannedType()}
                            disabled={saving}>
                            {tc("save")}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                    <div>
                      <Label>{t("unplanned.description")}</Label>
                      <Input
                        className="mt-1"
                        value={unDesc}
                        onChange={(e) => setUnDesc(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>{t("amount")}</Label>
                      <Input
                        inputMode="decimal"
                        className="mt-1"
                        value={unAmount}
                        onChange={(e) => setUnAmount(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>{t("date")}</Label>
                      <Input
                        type="date"
                        className="mt-1"
                        value={unDate}
                        onChange={(e) => setUnDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>{t("notes")}</Label>
                      <textarea
                        className="border-input bg-background ring-offset-background mt-1 flex min-h-[72px] w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={unNotes}
                        onChange={(e) => setUnNotes(e.target.value)}
                      />
                    </div>
                    <Button
                      className="w-full"
                      disabled={saving || !defaultCategoryId}
                      onClick={() => void onSubmitUnplanned()}>
                      {saving ? tc("saving") : tc("save")}
                    </Button>
                  </>
                ) : null}

                {selectedKind === "unexpected" ? (
                  <>
                    <div>
                      <Label>{t("unexpected.type")}</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {snapshot.unexpectedTypes.map((ty) => {
                          const Ico = expenseClassificationLucide(ty.icon);
                          const on = uxTypeId === ty.id;
                          return (
                            <div
                              key={ty.id}
                              className="group inline-flex items-center overflow-hidden rounded-full border border-border-default bg-bg-card">
                              <button
                                type="button"
                                onClick={() => setUxTypeId(ty.id)}
                                className={cn(
                                  "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium",
                                  on
                                    ? "bg-accent/15 text-accent"
                                    : "bg-transparent",
                                )}>
                                <Ico className="h-3.5 w-3.5" />
                                {ty.name}
                              </button>
                              {!ty.is_system ? (
                                <RowDeleteButton
                                  className="rounded-none border-l border-border-default"
                                  ariaLabel={tc("delete")}
                                  onClick={() =>
                                    confirmDeleteExpenseType(
                                      "unexpected",
                                      ty.id,
                                      ty.name,
                                    )
                                  }
                                />
                              ) : null}
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setUxNewTypeOpen(true)}
                          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border-default px-3 py-1.5 text-xs font-medium text-accent">
                          + {t("addType")}
                        </button>
                      </div>
                      {uxNewTypeOpen ? (
                        <div className="mt-2 flex gap-2">
                          <Input
                            value={uxNewTypeName}
                            onChange={(e) => setUxNewTypeName(e.target.value)}
                            placeholder={t("newTypePh")}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void addUnexpectedType()}
                            disabled={saving}>
                            {tc("save")}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                    <div>
                      <Label>{t("unexpected.description")}</Label>
                      <Input
                        className="mt-1"
                        value={uxDesc}
                        onChange={(e) => setUxDesc(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>{t("amount")}</Label>
                      <Input
                        inputMode="decimal"
                        className="mt-1"
                        value={uxAmount}
                        onChange={(e) => setUxAmount(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>{t("date")}</Label>
                      <Input
                        type="date"
                        className="mt-1"
                        value={uxDate}
                        onChange={(e) => setUxDate(e.target.value)}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={uxPermanent}
                        onChange={(e) => setUxPermanent(e.target.checked)}
                      />
                      {t("unexpected.permanent")}
                    </label>
                    {uxPermanent ? (
                      <div>
                        <Label>{t("unexpected.permanentNote")}</Label>
                        <textarea
                          className="border-input bg-background ring-offset-background mt-1 flex min-h-[72px] w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          value={uxPermanentNote}
                          onChange={(e) => setUxPermanentNote(e.target.value)}
                        />
                      </div>
                    ) : null}
                    <div>
                      <Label>{t("notes")}</Label>
                      <textarea
                        className="border-input bg-background ring-offset-background mt-1 flex min-h-[72px] w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={uxNotes}
                        onChange={(e) => setUxNotes(e.target.value)}
                      />
                    </div>
                    <Button
                      className="w-full"
                      disabled={saving || !defaultCategoryId || !uxDesc.trim()}
                      onClick={() => void onSubmitUnexpectedFixed()}>
                      {saving ? tc("saving") : tc("save")}
                    </Button>
                  </>
                ) : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
