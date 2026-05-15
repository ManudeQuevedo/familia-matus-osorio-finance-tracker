"use client";

import { ThemeProvider } from "next-themes";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  THEME_STORAGE_BASE,
  userPrefStorageKey,
} from "@/lib/storage/user-preferences-storage";

/** Guest key for unauthenticated routes (login, marketing). */
const GUEST_THEME_STORAGE_KEY = THEME_STORAGE_BASE;

export function FinanceThemeProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const syncUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      setReady(true);
    };

    void syncUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const storageKey = useMemo(
    () =>
      userId
        ? userPrefStorageKey(THEME_STORAGE_BASE, userId)
        : GUEST_THEME_STORAGE_KEY,
    [userId],
  );

  if (!ready) {
    return (
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        storageKey={GUEST_THEME_STORAGE_KEY}>
        {children}
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider
      key={storageKey}
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey={storageKey}>
      {children}
    </ThemeProvider>
  );
}
