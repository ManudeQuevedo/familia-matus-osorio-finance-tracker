"use client";

import { useTranslations } from "next-intl";

import { FinanceContentHeaderActions } from "@/components/finance/FinanceContentHeaderActions";
import { FinanceHeaderSearchTrigger } from "@/components/finance/finance-header-search-trigger";
import { FinancePageShell } from "@/components/finance/FinancePageShell";
import type { SettingsSnapshot } from "@/lib/finance/settings-queries";
import { SettingsPanels } from "@/features/finance/settings/settings-panels";
import type { SettingsTab } from "@/contexts/settings-modal-context";

export function SettingsPageClient({
  locale,
  initial,
  loadError,
}: {
  locale: string;
  initial: SettingsSnapshot | null;
  loadError: string | null;
}) {
  const t = useTranslations("Finance.settings");

  return (
    <FinancePageShell className="space-y-8 pb-8 md:pb-10">
      <header className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-text-secondary dark:text-text-muted">
            {t("subtitle")}
          </p>
        </div>
        <FinanceHeaderSearchTrigger />
        <FinanceContentHeaderActions />
      </header>
      <SettingsPanels
        locale={locale}
        initial={initial}
        loadError={loadError}
        variant="page"
        activeTab={"perfil" as SettingsTab}
      />
    </FinancePageShell>
  );
}
