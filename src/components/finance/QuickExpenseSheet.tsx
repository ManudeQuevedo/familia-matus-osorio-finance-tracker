"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AnimatedBottomSheet } from "@/components/motion/AnimatedBottomSheet";
import { Button } from "@/components/ui/button";
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
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { createQuickVariableExpense } from "@/lib/finance/actions";
import type { CategoryOption } from "@/lib/finance/dashboard-queries";
import type { ExpensesSnapshot } from "@/lib/finance/expenses-queries";
import { cn } from "@/lib/utils";

export type QuickExpenseMode = "normal" | "ant";

type QuickExpenseSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: QuickExpenseMode;
  onSaved?: () => void;
};

function isHormigaCategory(c: CategoryOption | undefined) {
  return c?.name_en === "Gastos hormiga" || c?.name_es === "Gastos hormiga";
}

export function QuickExpenseSheet({
  open,
  onOpenChange,
  mode = "normal",
  onSaved,
}: QuickExpenseSheetProps) {
  const t = useTranslations("Finance.dashboard");
  const tNav = useTranslations("Finance.nav");
  const intlLocale = useLocale();
  const locale = intlLocale === "es" ? "es" : "en";
  const isDesktop = useIsDesktop();
  const queryClient = useQueryClient();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data: snapshot, isLoading } = useQuery({
    queryKey: ["finance-expenses-quick", year, month, locale],
    queryFn: async () => {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
        locale,
      });
      const res = await fetch(`/api/finance/expenses?${params}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Request failed");
      }
      return (await res.json()) as ExpensesSnapshot;
    },
    enabled: open,
    staleTime: 60_000,
  });

  const [saving, setSaving] = useState(false);
  const [amountStr, setAmountStr] = useState("");
  const [pickedCategoryId, setPickedCategoryId] = useState<string | null>(null);
  const [pickedSubcategoryId, setPickedSubcategoryId] = useState<string | null>(
    null,
  );
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [hormiga, setHormiga] = useState(true);

  const resetForm = useCallback(() => {
    setAmountStr("");
    setPickedCategoryId(null);
    setPickedSubcategoryId(null);
    setDescription("");
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setHormiga(true);
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
      return;
    }
    if (mode === "ant" && snapshot?.categories.length) {
      const cat = snapshot.categories.find(isHormigaCategory);
      if (cat) {
        setPickedCategoryId(cat.id);
        setHormiga(true);
      }
    }
  }, [open, mode, snapshot?.categories, resetForm]);

  const categoryId = useMemo(() => {
    if (!snapshot?.categories.length) return "";
    if (
      pickedCategoryId &&
      snapshot.categories.some((c) => c.id === pickedCategoryId)
    ) {
      return pickedCategoryId;
    }
    return snapshot.categories[0]!.id;
  }, [snapshot, pickedCategoryId]);

  const subsForCategory = useMemo(() => {
    if (!snapshot || !categoryId) return [];
    return snapshot.subcategories.filter((s) => s.category_id === categoryId);
  }, [snapshot, categoryId]);

  const subcategoryId = useMemo(() => {
    if (!subsForCategory.length) return "";
    if (
      pickedSubcategoryId &&
      subsForCategory.some((s) => s.id === pickedSubcategoryId)
    ) {
      return pickedSubcategoryId;
    }
    return subsForCategory[0]!.id;
  }, [subsForCategory, pickedSubcategoryId]);

  const selectedCategory = snapshot?.categories.find(
    (c) => c.id === categoryId,
  );
  const showHormigaToggle = isHormigaCategory(selectedCategory);

  const onSave = async () => {
    if (!snapshot || !categoryId) return;
    const amount = Number.parseFloat(amountStr.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) return;
    setSaving(true);
    const desc =
      showHormigaToggle && hormiga
        ? description.trim()
          ? `${description.trim()} [hormiga]`
          : "[hormiga]"
        : description.trim();
    const res = await createQuickVariableExpense({
      locale,
      amount,
      categoryId,
      subcategoryId: subcategoryId || null,
      description: desc || " ",
      date: expenseDate,
    });
    setSaving(false);
    if (res.ok) {
      onOpenChange(false);
      resetForm();
      void queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["finance-expenses"] });
      onSaved?.();
    }
  };

  const form =
    isLoading || !snapshot ? (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    ) : (
      <div className="space-y-4">
        <div>
          <Label htmlFor="quick-expense-amount">{t("quick.amount")}</Label>
          <Input
            id="quick-expense-amount"
            inputMode="decimal"
            className="mt-1.5"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div>
          <Label>{t("quick.category")}</Label>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {snapshot.categories.map((c) => {
              const Icon = categoryLucideIcon(c.icon);
              const active = c.id === categoryId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setPickedCategoryId(c.id);
                    setPickedSubcategoryId(null);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border p-2 text-center text-xs font-medium transition",
                    active
                      ? "border-accent bg-accent-muted text-accent"
                      : "border-border-default bg-bg-card hover:border-border-strong dark:border-border-default bg-bg-card hover:border-border-strong",
                  )}>
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: c.color }}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="line-clamp-2">
                    {intlLocale === "es" ? c.name_es : c.name_en}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {subsForCategory.length ? (
          <div>
            <Label htmlFor="quick-expense-sub">{t("quick.subcategory")}</Label>
            <Select
              value={subcategoryId}
              onValueChange={(v) => setPickedSubcategoryId(v)}>
              <SelectTrigger id="quick-expense-sub" className="mt-1.5 w-full">
                <SelectValue placeholder={t("quick.subcategory")} />
              </SelectTrigger>
              <SelectContent>
                {subsForCategory.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div>
          <Label htmlFor="quick-expense-desc">{t("quick.description")}</Label>
          <Input
            id="quick-expense-desc"
            className="mt-1.5"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("quick.descriptionPlaceholder")}
          />
        </div>
        <div>
          <Label htmlFor="quick-expense-date">{t("quick.date")}</Label>
          <Input
            id="quick-expense-date"
            type="date"
            className="mt-1.5"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
          />
        </div>
        {showHormigaToggle ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hormiga}
              onChange={(e) => setHormiga(e.target.checked)}
              className="rounded border-zinc-300"
            />
            {t("quick.hormiga")}
          </label>
        ) : null}
      </div>
    );

  const footer = (
    <div className="flex justify-end gap-2">
      <Button variant="outline" onClick={() => onOpenChange(false)}>
        {tNav("cancel")}
      </Button>
      <Button
        disabled={saving || isLoading || !snapshot}
        onClick={() => void onSave()}>
        {t("quick.save")}
      </Button>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("quick.title")}</DialogTitle>
          </DialogHeader>
          {form}
          <div className="mt-4">{footer}</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <AnimatedBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("quick.title")}
      footer={footer}>
      {form}
    </AnimatedBottomSheet>
  );
}
