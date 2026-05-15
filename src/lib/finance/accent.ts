export const ACCENT_COLORS = [
  "emerald",
  "blue",
  "purple",
  "rose",
  "amber",
  "slate",
] as const;

export type AccentColor = (typeof ACCENT_COLORS)[number];

/** Hex values for charts, swatches, and Recharts (synced with globals.css HSL). */
export const ACCENT_SWATCH: Record<AccentColor, string> = {
  emerald: "#10b981",
  blue: "#3b82f6",
  purple: "#7c3aed",
  rose: "#e11d48",
  amber: "#f59e0b",
  slate: "#334155",
};

/** @deprecated Use ACCENT_STORAGE_BASE + userPrefStorageKey(userId) */
export const ACCENT_STORAGE_KEY = "finance-accent-color";

export { ACCENT_STORAGE_BASE } from "@/lib/storage/user-preferences-storage";

export function isAccentColor(value: string | null | undefined): value is AccentColor {
  return ACCENT_COLORS.includes(value as AccentColor);
}

export function normalizeAccentColor(
  value: string | null | undefined,
): AccentColor {
  return isAccentColor(value) ? value : "emerald";
}

export function getAccentChartColors(accent: AccentColor) {
  const main = ACCENT_SWATCH[accent];
  return {
    main,
    muted: `${main}33`,
    soft: `${main}1f`,
  };
}
