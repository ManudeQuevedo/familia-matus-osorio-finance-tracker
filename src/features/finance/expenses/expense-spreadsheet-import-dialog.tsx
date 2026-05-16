"use client";

import { Upload } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AppLocale } from "@/lib/finance/dashboard-queries";
import { importRecurringExpensesFromSheet } from "@/lib/finance/actions";
import type { ExpensesSnapshot } from "@/lib/finance/expenses-queries";
import {
  findCategory,
  inferColumnMapFromHeaders,
  mapSpreadsheetRow,
  processSpreadsheetFile,
  type ColumnMap,
  type ColumnMapKey,
} from "@/lib/import/process-spreadsheet";
import { cn } from "@/lib/utils";

const NONE = "__none__";

const MAP_FIELDS: {
  key: ColumnMapKey;
  labelKey: string;
  optional?: boolean;
}[] = [
  { key: "name", labelKey: "map.name" },
  { key: "category", labelKey: "map.category" },
  { key: "amount", labelKey: "map.amount" },
  { key: "dueDate", labelKey: "map.dueDate" },
  { key: "paycheck", labelKey: "map.paycheck" },
  { key: "status", labelKey: "map.status", optional: true },
];

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export function ExpenseSpreadsheetImportDialog({
  open,
  onOpenChange,
  snapshot,
  year,
  month,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: ExpensesSnapshot;
  year: number;
  month: number;
  onImported: () => void;
}) {
  const t = useTranslations("Finance.expenses.importExport");
  const intl = useLocale();
  const appLocale: AppLocale = intl === "es" ? "es" : "en";

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [columnMap, setColumnMap] = useState<ColumnMap>({});
  const [categoryRemap, setCategoryRemap] = useState<Record<string, string>>(
    {},
  );
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    imported: number;
    failures: { name: string; error: string }[];
    error?: string;
  } | null>(null);

  const categories = snapshot.categories;
  const subcategories = snapshot.subcategories;
  const accounts = snapshot.accounts;
  const defaultAccountId = snapshot.accounts[0]?.id ?? null;

  const headers = useMemo(() => {
    if (!rawRows.length) return [];
    return Object.keys(rawRows[0]).filter((k) => k && String(k).trim());
  }, [rawRows]);

  const mappedRows = useMemo(() => {
    return rawRows.map((row) => {
      const catCol = columnMap.category;
      const label =
        catCol && row[catCol] != null ? String(row[catCol]).trim() : "";
      const auto = findCategory(label, categories);
      const overrideId =
        !auto && label && categoryRemap[label] ? categoryRemap[label] : null;
      return mapSpreadsheetRow(
        row,
        columnMap,
        categories,
        subcategories,
        accounts,
        {
          defaultAccountId,
          categoryIdOverride: overrideId,
        },
      );
    });
  }, [
    rawRows,
    columnMap,
    categories,
    subcategories,
    accounts,
    defaultAccountId,
    categoryRemap,
  ]);

  const unknownCategoryLabels = useMemo(() => {
    const set = new Set<string>();
    if (!columnMap.category) return [];
    for (const row of rawRows) {
      const label = String(row[columnMap.category as string] ?? "").trim();
      if (!label) continue;
      if (!findCategory(label, categories)) set.add(label);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rawRows, columnMap.category, categories]);

  const counts = useMemo(() => {
    let ready = 0;
    let warn = 0;
    let invalid = 0;
    for (const m of mappedRows) {
      if (m.errors.length > 0) invalid++;
      else if (m.warnings.length > 0) warn++;
      else ready++;
    }
    return { ready, warn, invalid };
  }, [mappedRows]);

  const importablePayload = useMemo(() => {
    return mappedRows
      .filter((m) => m.errors.length === 0 && m.subcategoryId && m.accountId)
      .map((m) => ({
        name: m.name,
        subcategoryId: m.subcategoryId as string,
        accountId: m.accountId as string,
        amount: m.amount,
        paycheckPeriod: m.paycheck_period,
        dueDay: m.due_day,
        recordStatus: m.recordStatus,
      }));
  }, [mappedRows]);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setRawRows([]);
      setColumnMap({});
      setCategoryRemap({});
      setFileError(null);
      setDragOver(false);
      setImporting(false);
      setProgress(0);
      setResult(null);
    }
  }, [open]);

  const ingestFile = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return;
      setFileError(null);
      try {
        const rows = await processSpreadsheetFile(file);
        const cleaned = rows.filter((r) =>
          Object.values(r).some((v) => String(v ?? "").trim() !== ""),
        );
        if (!cleaned.length) {
          setFileError(t("emptyFile"));
          return;
        }
        setRawRows(cleaned);
        setColumnMap(inferColumnMapFromHeaders(Object.keys(cleaned[0])));
        setCategoryRemap({});
        setStep(2);
      } catch {
        setFileError(t("parseError"));
      }
    },
    [t],
  );

  const canProceedFromStep2 = Boolean(
    columnMap.name &&
    columnMap.category &&
    columnMap.amount &&
    columnMap.paycheck,
  );

  async function runImport() {
    if (!importablePayload.length) return;
    setStep(4);
    setImporting(true);
    setProgress(0);
    setResult(null);
    const batches = chunk(importablePayload, 50);
    let imported = 0;
    const failures: { name: string; error: string }[] = [];
    let batchError: string | undefined;

    for (let i = 0; i < batches.length; i++) {
      const res = await importRecurringExpensesFromSheet({
        locale: appLocale,
        year,
        month,
        rows: batches[i],
      });
      if (res.error) {
        batchError = res.error;
        failures.push(...res.failures);
        break;
      }
      imported += res.imported;
      failures.push(...res.failures);
      setProgress(Math.round(((i + 1) / batches.length) * 100));
    }

    setImporting(false);
    setResult({ imported, failures, error: batchError });
    if (imported > 0) onImported();
  }

  function errorLabel(code: string) {
    const keys = [
      "missing_name",
      "invalid_amount",
      "category_not_found",
      "missing_account",
      "no_subcategory_for_category",
      "invalid_row",
      "unauthorized",
      "family_not_configured",
      "unsupported_format",
    ] as const;
    if ((keys as readonly string[]).includes(code)) {
      return t(`errors.${code}` as "errors.missing_name");
    }
    return code;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-text-muted">
              {t("step1Title")}
            </p>
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  document.getElementById("expense-import-file")?.click();
                }
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                void ingestFile(f);
              }}
              onClick={() =>
                document.getElementById("expense-import-file")?.click()
              }
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition",
                dragOver
                  ? "border-accent bg-accent-muted/30"
                  : "border-border-default bg-bg-card hover:border-accent/50",
              )}>
              <Upload className="mb-3 h-10 w-10 text-text-muted" />
              <p className="text-sm font-medium">{t("dropHere")}</p>
              <p className="mt-2 text-xs text-text-muted">{t("formats")}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 pointer-events-none">
                {t("selectFile")}
              </Button>
            </div>
            <input
              id="expense-import-file"
              type="file"
              accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                void ingestFile(f);
                e.target.value = "";
              }}
            />
            {fileError ? (
              <p className="text-sm text-destructive">{fileError}</p>
            ) : null}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm font-medium">{t("step2Title")}</p>
            <div className="max-h-40 overflow-auto rounded-lg border border-border-default">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-bg-card">
                  <tr>
                    {headers.slice(0, 8).map((h) => (
                      <th
                        key={h}
                        className="border-b border-border-default px-2 py-2 font-medium whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rawRows.slice(0, 5).map((row, ri) => (
                    <tr key={ri}>
                      {headers.slice(0, 8).map((h) => (
                        <td
                          key={h}
                          className="max-w-[140px] truncate border-b border-border-default px-2 py-1.5">
                          {String(row[h] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {MAP_FIELDS.map(({ key, labelKey, optional }) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs">{t(labelKey)}</Label>
                  <Select
                    value={columnMap[key] ?? NONE}
                    onValueChange={(v) => {
                      setColumnMap((prev) => {
                        const next = { ...prev };
                        if (v === NONE) delete next[key];
                        else next[key] = v;
                        return next;
                      });
                    }}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("map.pick")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>{t("map.none")}</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="flex justify-between gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                {t("back")}
              </Button>
              <Button
                type="button"
                disabled={!canProceedFromStep2}
                onClick={() => setStep(3)}>
                {t("next")}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm font-medium">{t("step3Title")}</p>
            <p className="text-sm text-text-muted">
              {t("rowSummary", {
                ready: counts.ready,
                warn: counts.warn,
                invalid: counts.invalid,
              })}
            </p>

            {unknownCategoryLabels.length > 0 ? (
              <div className="space-y-3 rounded-lg border border-border-default p-3">
                <p className="text-xs font-medium">{t("remapTitle")}</p>
                {unknownCategoryLabels.map((label) => (
                  <div
                    key={label}
                    className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs text-text-secondary">
                      {t("unknownCategory", { label })}
                    </span>
                    <Select
                      value={categoryRemap[label] ?? NONE}
                      onValueChange={(v) => {
                        setCategoryRemap((prev) => {
                          const n = { ...prev };
                          if (v === NONE) delete n[label];
                          else n[label] = v;
                          return n;
                        });
                      }}>
                      <SelectTrigger className="w-full sm:w-[220px]">
                        <SelectValue placeholder={t("pickCategory")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t("map.none")}</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c[appLocale === "es" ? "name_es" : "name_en"]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="max-h-[min(55vh,420px)] overflow-auto rounded-lg border border-border-default">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-bg-card">
                  <tr className="border-b border-border-default">
                    <th className="w-8 px-2 py-2" />
                    <th className="px-2 py-2 font-medium">{t("colName")}</th>
                    <th className="px-2 py-2 font-medium">
                      {t("colCategory")}
                    </th>
                    <th className="px-2 py-2 text-right font-medium">
                      {t("colAmount")}
                    </th>
                    <th className="px-2 py-2 font-medium">{t("colIssues")}</th>
                  </tr>
                </thead>
                <tbody>
                  {mappedRows.map((m, i) => {
                    const ok = m.errors.length === 0;
                    const icon = ok
                      ? m.warnings.length > 0
                        ? "⚠️"
                        : "✅"
                      : "❌";
                    return (
                      <tr key={i} className="border-b border-border-default">
                        <td className="px-2 py-1.5 text-lg">{icon}</td>
                        <td className="max-w-[120px] truncate px-2 py-1.5">
                          {m.name || "—"}
                        </td>
                        <td className="max-w-[120px] truncate px-2 py-1.5">
                          {m.categoryLabel}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {m.amount.toFixed(2)}
                        </td>
                        <td className="px-2 py-1.5 text-text-muted">
                          {[
                            ...m.errors.map(errorLabel),
                            ...m.warnings.map((w) => t(`warnings.${w}`)),
                          ].join(" · ")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap justify-between gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep(2)}>
                {t("back")}
              </Button>
              <Button
                type="button"
                disabled={
                  importablePayload.length === 0 ||
                  unknownCategoryLabels.some((l) => !categoryRemap[l])
                }
                onClick={() => void runImport()}>
                {t("importN", { count: importablePayload.length })}
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm font-medium">{t("step4Title")}</p>
            {importing ? (
              <div className="space-y-2">
                <p className="text-sm text-text-muted">
                  {t("importing", { count: importablePayload.length })}
                </p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-accent transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-text-muted">
                  {t("progress", { pct: progress })}
                </p>
              </div>
            ) : result ? (
              <div className="space-y-3">
                {result.error ? (
                  <p className="text-sm text-destructive">
                    {errorLabel(result.error)}
                  </p>
                ) : null}
                {result.imported > 0 ? (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">
                    ✅ {t("done", { count: result.imported })}
                  </p>
                ) : null}
                {result.failures.length > 0 ? (
                  <div>
                    <p className="mb-1 text-xs font-medium text-destructive">
                      {t("failures")}
                    </p>
                    <ul className="max-h-40 list-inside list-disc space-y-0.5 overflow-y-auto text-xs text-text-muted">
                      {result.failures.map((f, i) => (
                        <li key={i}>
                          {f.name}: {f.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <Button type="button" onClick={() => onOpenChange(false)}>
                  {t("close")}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
