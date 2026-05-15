/** Base keys (without userId). Always use `userPrefStorageKey` when reading/writing. */
export const ACCENT_STORAGE_BASE = "finance-accent-color";
export const SIDEBAR_COLLAPSED_STORAGE_BASE = "finance-sidebar-collapsed";
export const SIDEBAR_ICON_STORAGE_BASE = "finance-sidebar-icon";
export const THEME_STORAGE_BASE = "finance-theme";

const LEGACY_KEYS = [
  ACCENT_STORAGE_BASE,
  SIDEBAR_COLLAPSED_STORAGE_BASE,
  SIDEBAR_ICON_STORAGE_BASE,
  THEME_STORAGE_BASE,
] as const;

export function userPrefStorageKey(base: string, userId: string): string {
  return `${base}-${userId}`;
}

export function getUserPref(
  base: string,
  userId: string,
): string | null {
  if (typeof window === "undefined") return null;
  try {
    const scopedKey = userPrefStorageKey(base, userId);
    const scoped = localStorage.getItem(scopedKey);
    if (scoped !== null) return scoped;

    const legacy = localStorage.getItem(base);
    if (legacy !== null) {
      localStorage.setItem(scopedKey, legacy);
      localStorage.removeItem(base);
      return legacy;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function setUserPref(
  base: string,
  userId: string,
  value: string,
): void {
  try {
    localStorage.setItem(userPrefStorageKey(base, userId), value);
  } catch {
    /* ignore */
  }
}

export function clearUserPreferences(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    for (const base of LEGACY_KEYS) {
      localStorage.removeItem(base);
      localStorage.removeItem(userPrefStorageKey(base, userId));
    }
  } catch {
    /* ignore */
  }
}
