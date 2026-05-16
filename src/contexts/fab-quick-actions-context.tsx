"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { TooltipProvider } from "@/components/ui/tooltip";

import {
  QuickActionFab,
  type QuickActionId,
} from "@/components/finance/QuickActionFab";
import { dispatchOpenAiChat } from "@/components/providers/AiChatProvider";
import { QuickNoteSheet } from "@/features/finance/notes/QuickNoteSheet";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { useRouter } from "@/i18n/navigation";
import { useModKeyLabel } from "@/lib/hooks/use-mod-key-label";

/** Hotkey / palette actions mapped to FAB behaviour */
export type FabHotkeyKind = "expense" | "income" | "goal" | "note";

type FabQuickActionsContextValue = {
  openFabAction: (kind: FabHotkeyKind) => void;
};

const FabQuickActionsContext =
  createContext<FabQuickActionsContextValue | null>(null);

export function FabQuickActionsProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isDesktop = useIsDesktop();
  const mod = useModKeyLabel();

  const fabShortcutHints = useMemo(
    () => ({
      quickExpense: `${mod}+N`,
      income: `${mod}+I`,
      goal: `${mod}+G`,
    }),
    [mod],
  );

  const [quickNoteOpen, setQuickNoteOpen] = useState(false);

  const onFabSelect = useCallback(
    (id: QuickActionId) => {
      switch (id) {
        case "askAi":
          dispatchOpenAiChat();
          break;
        case "antExpense":
          router.push("/expenses?add=unplanned&from=dashboard");
          break;
        case "quickExpense":
          router.push("/expenses?add=unexpected&from=dashboard");
          break;
        case "income":
          router.push("/incomes");
          break;
        case "goal":
          router.push("/goals");
          break;
        case "quickNote":
          setQuickNoteOpen(true);
          break;
        default:
          break;
      }
    },
    [router],
  );

  const openFabAction = useCallback(
    (kind: FabHotkeyKind) => {
      switch (kind) {
        case "expense":
          router.push("/expenses?add=1");
          break;
        case "income":
          router.push("/incomes");
          break;
        case "goal":
          router.push("/goals");
          break;
        case "note":
          setQuickNoteOpen(true);
          break;
      }
    },
    [router],
  );

  const value = useMemo(() => ({ openFabAction }), [openFabAction]);

  return (
    <FabQuickActionsContext.Provider value={value}>
      <TooltipProvider delayDuration={0}>
        {children}
        <QuickActionFab
          shortcutHints={fabShortcutHints}
          onSelect={onFabSelect}
        />
        <QuickNoteSheet
          open={quickNoteOpen}
          onOpenChange={setQuickNoteOpen}
          isDesktop={isDesktop}
          locale={locale}
          onSaved={() => {
            void queryClient.invalidateQueries({
              queryKey: ["finance-notes-reminders-today"],
            });
            void queryClient.invalidateQueries({
              queryKey: ["finance-notes"],
            });
          }}
        />
      </TooltipProvider>
    </FabQuickActionsContext.Provider>
  );
}

export function useFabQuickActions() {
  const ctx = useContext(FabQuickActionsContext);
  if (!ctx) {
    throw new Error(
      "useFabQuickActions must be used within FabQuickActionsProvider",
    );
  }
  return ctx;
}
