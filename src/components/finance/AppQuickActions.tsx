"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { useCallback, useState } from "react";

import {
  QuickActionFab,
  type QuickActionId,
} from "@/components/finance/QuickActionFab";
import {
  QuickExpenseSheet,
  type QuickExpenseMode,
} from "@/components/finance/QuickExpenseSheet";
import { dispatchOpenAiChat } from "@/components/providers/AiChatProvider";
import { QuickNoteSheet } from "@/features/finance/notes/QuickNoteSheet";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { useRouter } from "@/i18n/navigation";

export function AppQuickActions() {
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isDesktop = useIsDesktop();

  const [quickExpenseOpen, setQuickExpenseOpen] = useState(false);
  const [quickExpenseMode, setQuickExpenseMode] =
    useState<QuickExpenseMode>("normal");
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);

  const openQuickExpense = useCallback((mode: QuickExpenseMode = "normal") => {
    setQuickExpenseMode(mode);
    setQuickExpenseOpen(true);
  }, []);

  const onFabSelect = useCallback(
    (id: QuickActionId) => {
      switch (id) {
        case "askAi":
          dispatchOpenAiChat();
          break;
        case "antExpense":
          openQuickExpense("ant");
          break;
        case "quickExpense":
          openQuickExpense("normal");
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
    [openQuickExpense, router],
  );

  return (
    <>
      <QuickActionFab onSelect={onFabSelect} />

      <QuickExpenseSheet
        open={quickExpenseOpen}
        onOpenChange={setQuickExpenseOpen}
        mode={quickExpenseMode}
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
          void queryClient.invalidateQueries({ queryKey: ["finance-notes"] });
        }}
      />
    </>
  );
}
