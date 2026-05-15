import { normalizeEmail } from "@/lib/auth/allowed-emails";

export const MANUEL_EMAIL = "manuel.matusdequevedo@gmail.com";
export const CAROLINA_EMAIL = "carolina.matus.osorio@gmail.com";

export const HOUSEHOLD_EMAILS = [MANUEL_EMAIL, CAROLINA_EMAIL] as const;

export type HouseholdPerson = "manuel" | "carolina" | "unknown";

export function personFromEmail(
  email: string | null | undefined,
): HouseholdPerson {
  const e = normalizeEmail(email ?? "");
  if (e === MANUEL_EMAIL) return "manuel";
  if (e === CAROLINA_EMAIL) return "carolina";
  return "unknown";
}

/** UI quincena 1 (1–15) → DB paycheck_period 2. UI quincena 2 (15–30) → DB period 1. */
export function uiQuincenaToDbPeriod(ui: 1 | 2): 1 | 2 {
  return ui === 1 ? 2 : 1;
}

export function dbPeriodToUiQuincena(db: 1 | 2): 1 | 2 {
  return db === 2 ? 1 : 2;
}

export function dueLabel(
  dueDay: number | null,
  everyPaycheckLabel: string,
): string {
  if (dueDay == null) return everyPaycheckLabel;
  return String(dueDay);
}
