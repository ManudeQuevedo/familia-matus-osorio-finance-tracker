"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useHotkeysHelp } from "@/contexts/hotkeys-help-context";
import { cn } from "@/lib/utils";
import { useModKeyLabel } from "@/lib/hooks/use-mod-key-label";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback } from "react";

function Row({ label, shortcutText }: { label: string; shortcutText: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-2 py-1.5">
      <span className="text-sm text-text-primary">{label}</span>
      <kbd
        className={cn(
          "inline-flex shrink-0 items-center rounded-md border border-border-default bg-[var(--bg-badge)] px-1.5 py-px font-mono text-[11px] text-text-muted",
        )}>
        {shortcutText}
      </kbd>
    </div>
  );
}

export function HotkeysHelpDialog() {
  const { open, closeHotkeysHelp } = useHotkeysHelp();
  const t = useTranslations("Finance.hotkeys");
  const mod = useModKeyLabel();

  const chordWith = useCallback((suffix: string) => `${mod}+${suffix}`, [mod]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeHotkeysHelp()}>
      <DialogContent className="max-h-[85dvh] max-w-[480px] gap-0 overflow-y-auto border border-border-default p-0 [&>button]:hidden shadow-[var(--shadow-modal)]">
        <div className="flex items-start justify-between border-b border-border-subtle px-5 py-4">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-base font-semibold text-text-primary">
              {t("title")}
            </DialogTitle>
            <DialogDescription className="text-sm text-text-muted">
              {t("subtitle")}
            </DialogDescription>
          </DialogHeader>
          <button
            type="button"
            className="-mr-2 -mt-2 rounded-sm p-2 text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t("close")}
            onClick={closeHotkeysHelp}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-4 py-5">
          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              {t("groupNav")}
            </p>
            <div className="space-y-0.5">
              <Row label={t("navDashboard")} shortcutText={`${mod}1`} />
              <Row label={t("navExpenses")} shortcutText={`${mod}2`} />
              <Row label={t("navIncomes")} shortcutText={`${mod}3`} />
              <Row label={t("navGoals")} shortcutText={`${mod}4`} />
              <Row label={t("navDebts")} shortcutText={`${mod}5`} />
              <Row label={t("navReports")} shortcutText={`${mod}6`} />
            </div>
          </section>

          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              {t("groupActions")}
            </p>
            <div className="space-y-0.5">
              <Row label={t("actExpense")} shortcutText={chordWith("N")} />
              <Row label={t("actIncome")} shortcutText={chordWith("I")} />
              <Row label={t("actGoal")} shortcutText={chordWith("G")} />
              <Row label={t("actAi")} shortcutText={`${mod}/`} />
              <Row label={t("actSettings")} shortcutText={`${mod},`} />
            </div>
          </section>

          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              {t("groupUi")}
            </p>
            <div className="space-y-0.5">
              <Row label={t("uiSearch")} shortcutText={chordWith("K")} />
              <Row label={t("uiSidebar")} shortcutText={chordWith("B")} />
              <Row label={t("uiCloseModal")} shortcutText={t("keyEscape")} />
              <Row label={t("uiShortcuts")} shortcutText="?" />
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
