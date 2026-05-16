"use client";

import { FINANCE_PATH_BY_KEY } from "@/components/finance/finance-nav-config";
import { CommandMenuBootstrap } from "@/components/layout/command-menu-bootstrap";
import { HotkeysHelpDialog } from "@/components/layout/hotkeys-help-dialog";
import { useCommandMenu } from "@/contexts/command-menu-context";
import { useFabQuickActions } from "@/contexts/fab-quick-actions-context";
import { useHotkeysHelp } from "@/contexts/hotkeys-help-context";
import { useSettingsModal } from "@/contexts/settings-modal-context";
import { useHotkey } from "@/lib/hooks/use-hotkeys";
import { useRouter } from "@/i18n/navigation";

export function FinanceHotkeysProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { openSettings } = useSettingsModal();
  const { openCommandMenu } = useCommandMenu();
  const { openFabAction } = useFabQuickActions();
  const { openHotkeysHelp } = useHotkeysHelp();

  useHotkey("k", openCommandMenu, { meta: true });
  useHotkey("n", () => openFabAction("expense"), { meta: true });
  useHotkey("i", () => openFabAction("income"), { meta: true });
  useHotkey("g", () => openFabAction("goal"), { meta: true });
  useHotkey("/", () => router.push(FINANCE_PATH_BY_KEY.ai), { meta: true });
  useHotkey(",", () => openSettings(), { meta: true });

  useHotkey("1", () => router.push(FINANCE_PATH_BY_KEY.dashboard), {
    meta: true,
  });
  useHotkey("2", () => router.push(FINANCE_PATH_BY_KEY.expenses), {
    meta: true,
  });
  useHotkey("3", () => router.push(FINANCE_PATH_BY_KEY.incomes), {
    meta: true,
  });
  useHotkey("4", () => router.push(FINANCE_PATH_BY_KEY.goals), { meta: true });
  useHotkey("5", () => router.push(FINANCE_PATH_BY_KEY.debts), {
    meta: true,
  });
  useHotkey("6", () => router.push(FINANCE_PATH_BY_KEY.reports), {
    meta: true,
  });

  useHotkey(
    "b",
    () => {
      window.dispatchEvent(new CustomEvent("toggle-sidebar"));
    },
    { meta: true },
  );

  useHotkey("?", () => openHotkeysHelp(), { shift: true });

  return (
    <>
      {children}
      <CommandMenuBootstrap />
      <HotkeysHelpDialog />
    </>
  );
}
