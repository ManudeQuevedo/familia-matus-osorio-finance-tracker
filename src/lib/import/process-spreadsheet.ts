import type { ParseResult } from "papaparse";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export type ImportCategoryLookup = {
  id: string;
  name_en: string;
  name_es: string;
};

export type ImportSubcategoryLookup = {
  id: string;
  category_id: string;
  name: string;
};

export type ImportAccountLookup = {
  id: string;
  name: string;
};

export type ColumnMapKey =
  | "name"
  | "category"
  | "amount"
  | "dueDate"
  | "status"
  | "paycheck";

export type ColumnMap = Partial<Record<ColumnMapKey, string>>;

const SHEET_ACCOUNT_HINTS = [
  "Alex Savings Account",
  "Carolina's Savings Account",
];

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function cellStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

export async function processSpreadsheetFile(
  file: File,
): Promise<Record<string, unknown>[]> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "csv") {
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, unknown>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results: ParseResult<Record<string, unknown>>) => {
          resolve((results.data ?? []) as Record<string, unknown>[]);
        },
        error: (err) => reject(err),
      });
    });
  }

  if (ext === "xlsx" || ext === "xls") {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });
  }

  throw new Error("unsupported_format");
}

/** Match Google Sheet headers → column map keys. */
export function inferColumnMapFromHeaders(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  const normToOriginal = new Map<string, string>();
  for (const h of headers) {
    if (!h) continue;
    normToOriginal.set(norm(h), h);
  }

  const setIf = (key: ColumnMapKey, patterns: string[]) => {
    for (const p of patterns) {
      const orig = normToOriginal.get(norm(p));
      if (orig) {
        map[key] = orig;
        return;
      }
    }
  };

  setIf("paycheck", ["paycheck"]);
  setIf("dueDate", ["due date", "due_date", "fecha", "vencimiento"]);
  setIf("name", ["expenses", "expense", "gasto", "gastos", "name", "nombre"]);
  setIf("category", [
    "categories",
    "category",
    "categoría",
    "categoria",
    "categorias",
  ]);
  setIf("amount", ["amount", "monto", "importe"]);
  setIf("status", ["status", "estado"]);

  return map;
}

function parsePaycheckPeriod(raw: string): 1 | 2 {
  const s = raw.trim();
  if (!s) return 2;
  const digits = s.replace(/\D/g, "");
  if (digits === "1") return 1;
  if (digits === "2") return 2;
  if (/^1\b/.test(s) || /\b1\b/.test(s)) return 1;
  if (/^2\b/.test(s) || /\b2\b/.test(s)) return 2;
  return 2;
}

function parseDueDay(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (norm(s) === "every paycheck" || norm(s) === "cada quincena") {
    return null;
  }
  const n = Number.parseInt(s.replace(/\D/g, ""), 10);
  if (!Number.isFinite(n) || n < 1 || n > 31) return null;
  return n;
}

export function findCategory(
  label: string | undefined,
  categories: ImportCategoryLookup[],
): ImportCategoryLookup | undefined {
  if (!label?.trim()) return undefined;
  const n = norm(label);
  return categories.find(
    (c) => norm(c.name_en) === n || norm(c.name_es) === n,
  );
}

export function defaultSubcategoryForCategory(
  categoryId: string,
  subcategories: ImportSubcategoryLookup[],
): string | null {
  const subs = subcategories
    .filter((s) => s.category_id === categoryId)
    .sort((a, b) => a.name.localeCompare(b.name));
  return subs[0]?.id ?? null;
}

function matchAccountId(
  statusRaw: string,
  accounts: ImportAccountLookup[],
): string | null {
  const t = statusRaw.trim();
  if (!t) return null;
  const nt = norm(t);
  for (const a of accounts) {
    if (norm(a.name) === nt) return a.id;
  }
  for (const h of SHEET_ACCOUNT_HINTS) {
    if (norm(h) === nt) {
      const hit = accounts.find((a) => norm(a.name) === norm(h));
      if (hit) return hit.id;
    }
  }
  return null;
}

function parseRecordStatus(
  statusRaw: string,
  accounts: ImportAccountLookup[],
): { status: "paid" | "pending"; accountFromStatus: string | null } {
  const t = statusRaw.trim();
  const nt = norm(t);
  if (!t) return { status: "pending", accountFromStatus: null };

  if (nt === "paid" || nt === "pagado") {
    return { status: "paid", accountFromStatus: null };
  }
  if (
    nt === "pending for payment" ||
    nt === "pending" ||
    nt === "pendiente" ||
    nt === "pendiente de pago"
  ) {
    return { status: "pending", accountFromStatus: null };
  }

  const acct = matchAccountId(t, accounts);
  if (acct) return { status: "paid", accountFromStatus: acct };

  for (const h of SHEET_ACCOUNT_HINTS) {
    if (norm(h) === nt) {
      const id = matchAccountId(h, accounts);
      if (id) return { status: "paid", accountFromStatus: id };
    }
  }

  return { status: "pending", accountFromStatus: null };
}

export type MappedExpenseRow = {
  name: string;
  categoryId: string | null;
  categoryLabel: string;
  subcategoryId: string | null;
  amount: number;
  paycheck_period: 1 | 2;
  due_day: number | null;
  recordStatus: "paid" | "pending";
  accountId: string | null;
  errors: string[];
  warnings: string[];
};

export function mapSpreadsheetRow(
  row: Record<string, unknown>,
  columnMap: ColumnMap,
  categories: ImportCategoryLookup[],
  subcategories: ImportSubcategoryLookup[],
  accounts: ImportAccountLookup[],
  options?: {
    defaultAccountId: string | null;
    categoryIdOverride?: string | null;
  },
): MappedExpenseRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  const nameCol = columnMap.name;
  const catCol = columnMap.category;
  const amountCol = columnMap.amount;
  const dueCol = columnMap.dueDate;
  const statusCol = columnMap.status;
  const payCol = columnMap.paycheck;

  const name = nameCol ? cellStr(row[nameCol]) : "";
  const categoryLabel = catCol ? cellStr(row[catCol]) : "";
  const amountRaw =
    amountCol != null ? cellStr(row[amountCol]).replace(/[$,\s]/g, "") : "";
  const amount = Number.parseFloat(amountRaw);
  const dueDateRaw = dueCol != null ? cellStr(row[dueCol]) : "";
  const statusRaw = statusCol != null ? cellStr(row[statusCol]) : "";
  const paycheckRaw = payCol != null ? cellStr(row[payCol]) : "";

  const paycheck_period = parsePaycheckPeriod(paycheckRaw);
  const due_day = parseDueDay(dueDateRaw);

  const { status: recordStatus, accountFromStatus } = parseRecordStatus(
    statusRaw,
    accounts,
  );

  let accountId = accountFromStatus ?? options?.defaultAccountId ?? null;

  const cat = options?.categoryIdOverride
    ? categories.find((c) => c.id === options.categoryIdOverride)
    : findCategory(categoryLabel, categories);

  const categoryId = cat?.id ?? null;
  const subcategoryId = categoryId
    ? defaultSubcategoryForCategory(categoryId, subcategories)
    : null;

  if (!name) errors.push("missing_name");
  if (!Number.isFinite(amount) || amount < 0) errors.push("invalid_amount");
  if (!categoryId) errors.push("category_not_found");
  if (categoryId && !subcategoryId)
    errors.push("no_subcategory_for_category");

  if (!accountId) {
    accountId = options?.defaultAccountId ?? null;
  }
  if (!accountId) errors.push("missing_account");

  if (
    recordStatus === "paid" &&
    !accountFromStatus &&
    accountId === options?.defaultAccountId &&
    options?.defaultAccountId
  ) {
    warnings.push("paid_default_account");
  }

  return {
    name,
    categoryId,
    categoryLabel: categoryLabel || "—",
    subcategoryId,
    amount: Number.isFinite(amount) ? amount : 0,
    paycheck_period,
    due_day,
    recordStatus,
    accountId,
    errors,
    warnings,
  };
}

export function exportStatusForSheet(
  status: string,
  intl: "en" | "es",
): string {
  if (status === "paid") return intl === "es" ? "Pagado" : "Paid";
  if (status === "overdue")
    return intl === "es" ? "Pendiente de pago" : "Pending for payment";
  return intl === "es" ? "Pendiente de pago" : "Pending for payment";
}

export type SheetExportRow = {
  Paycheck: number;
  "Due Date": string;
  Expenses: string;
  Categories: string;
  Amount: number;
  Status: string;
};

export function downloadExpensesWorkbook(
  rows: SheetExportRow[],
  filename: string,
) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Expenses");
  XLSX.writeFile(wb, filename);
}

/** @deprecated Prefer `processSpreadsheetFile` — alias for spreadsheet import specs. */
export const processFile = processSpreadsheetFile;

/** @deprecated Prefer `mapSpreadsheetRow` — alias for spreadsheet import specs. */
export const mapRow = mapSpreadsheetRow;
