"use client";

import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";

import { updateProfilePreferences } from "@/lib/finance/settings-actions";
import {
  getUserPref,
  THEME_STORAGE_BASE,
} from "@/lib/storage/user-preferences-storage";

export type ThemePreference = "light" | "dark" | "system";

/** Applies profile theme when the user has no local preference yet. */
export function ProfileThemeBootstrap({
  userId,
  initialTheme,
}: {
  userId: string;
  initialTheme: ThemePreference;
}) {
  const { setTheme } = useTheme();

  useEffect(() => {
    const stored = getUserPref(THEME_STORAGE_BASE, userId);
    if (!stored) {
      setTheme(initialTheme);
    }
  }, [initialTheme, setTheme, userId]);

  return null;
}

export function cycleThemePreference(
  current: ThemePreference,
): ThemePreference {
  if (current === "light") return "dark";
  if (current === "dark") return "system";
  return "light";
}

export function useThemePreference(serverTheme: ThemePreference = "system") {
  const {
    theme,
    setTheme: setNextTheme,
    resolvedTheme,
    systemTheme,
  } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const setTheme = useCallback(
    async (next: ThemePreference, locale: string) => {
      setNextTheme(next);
      await updateProfilePreferences({
        locale,
        preferredTheme: next,
      });
    },
    [setNextTheme],
  );

  const cycleTheme = useCallback(
    async (locale: string) => {
      const current = (mounted ? theme : serverTheme) as
        | ThemePreference
        | undefined;
      const next = cycleThemePreference(current ?? "system");
      await setTheme(next, locale);
    },
    [mounted, theme, serverTheme, setTheme],
  );

  const activeTheme = (mounted ? theme : serverTheme) as
    | ThemePreference
    | undefined;
  const resolved: "light" | "dark" =
    resolvedTheme === "dark" || resolvedTheme === "light"
      ? resolvedTheme
      : systemTheme === "dark"
        ? "dark"
        : "light";

  return {
    theme: (activeTheme ?? "system") as ThemePreference,
    displayTheme: (activeTheme ?? "system") as ThemePreference,
    resolved,
    hydrated: mounted,
    setTheme,
    cycleTheme,
  };
}
