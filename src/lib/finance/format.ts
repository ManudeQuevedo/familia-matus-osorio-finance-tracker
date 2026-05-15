export function formatMxn(locale: string, value: number) {
  return new Intl.NumberFormat(locale === "es" ? "es-MX" : "en-US", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatUsd(locale: string, value: number) {
  return new Intl.NumberFormat(locale === "es" ? "es-MX" : "en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatMonthYear(locale: string, year: number, month: number) {
  return new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

export function formatShortDate(locale: string, iso: string) {
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  return new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    day: "numeric",
    month: "short",
  }).format(d);
}

export function formatDayHeading(locale: string, iso: string) {
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  return new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

export function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number.parseFloat(v) || 0;
  return 0;
}
