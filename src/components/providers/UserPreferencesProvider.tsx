"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

import { normalizeAccentColor, type AccentColor } from "@/lib/finance/accent";
import {
  ACCENT_STORAGE_BASE,
  getUserPref,
  setUserPref,
} from "@/lib/storage/user-preferences-storage";

type UserPreferencesContextValue = {
  avatarUrl: string | null;
  setAvatarUrl: (url: string | null) => void;
  accentColor: AccentColor;
  setAccentColor: (accent: AccentColor) => void;
};

const UserPreferencesContext =
  createContext<UserPreferencesContextValue | null>(null);

function applyAccentToDom(accent: AccentColor) {
  document.documentElement.dataset.accent = accent;
}

export function UserPreferencesProvider({
  userId,
  initialAvatarUrl,
  initialAccentColor,
  children,
}: {
  userId: string;
  initialAvatarUrl: string | null;
  initialAccentColor: AccentColor;
  children: React.ReactNode;
}) {
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [accentColor, setAccentColorState] = useState(() =>
    normalizeAccentColor(initialAccentColor),
  );

  useLayoutEffect(() => {
    queueMicrotask(() => {
      const serverAccent = normalizeAccentColor(initialAccentColor);
      const stored = getUserPref(ACCENT_STORAGE_BASE, userId);
      if (stored) {
        const accent = normalizeAccentColor(stored);
        setAccentColorState(accent);
        applyAccentToDom(accent);
        return;
      }
      setUserPref(ACCENT_STORAGE_BASE, userId, serverAccent);
      setAccentColorState(serverAccent);
      applyAccentToDom(serverAccent);
    });
  }, [initialAccentColor, userId]);

  const setAccentColor = useCallback(
    (accent: AccentColor) => {
      setAccentColorState(accent);
      applyAccentToDom(accent);
      setUserPref(ACCENT_STORAGE_BASE, userId, accent);
    },
    [userId],
  );

  const value = useMemo(
    () => ({
      avatarUrl,
      setAvatarUrl,
      accentColor,
      setAccentColor,
    }),
    [avatarUrl, accentColor, setAccentColor],
  );

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences() {
  const ctx = useContext(UserPreferencesContext);
  if (!ctx) {
    throw new Error(
      "useUserPreferences must be used within UserPreferencesProvider",
    );
  }
  return ctx;
}
