"use client";

import { useEffect } from "react";

import { useSettingsModal } from "@/contexts/settings-modal-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { bindToastRegistry, resetToastRegistry } from "@/lib/toast";

export function ToastHooksBridge() {
  const { openSettings } = useSettingsModal();

  useEffect(() => {
    bindToastRegistry({
      openAccountsSettings: () => openSettings("datos"),
      refreshSession: async () => {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.refreshSession();
      },
    });
    return () => resetToastRegistry();
  }, [openSettings]);

  return null;
}
