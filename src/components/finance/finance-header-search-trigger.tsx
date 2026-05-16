"use client";

import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { useCommandMenu } from "@/contexts/command-menu-context";
import { useModKeyLabel } from "@/lib/hooks/use-mod-key-label";
import { cn } from "@/lib/utils";

type FinanceHeaderSearchTriggerProps = {
  /** Default: centered in a relative header. Use `inline` between flex siblings (e.g. note editor). */
  variant?: "floating" | "inline";
};

export function FinanceHeaderSearchTrigger({
  variant = "floating",
}: FinanceHeaderSearchTriggerProps) {
  const { openCommandMenu } = useCommandMenu();
  const mod = useModKeyLabel();
  const t = useTranslations("Finance.commandMenu");

  return (
    <motion.button
      type="button"
      onClick={() => openCommandMenu()}
      aria-label={t("searchTriggerAria")}
      className={cn(
        "search-trigger hidden md:flex",
        variant === "floating" && "search-trigger--floating",
      )}>
      <Search className="size-[14px] shrink-0 text-text-muted" aria-hidden />
      <span className="text-[13px] text-text-muted">
        {t("searchTriggerPlaceholder")}
      </span>
      <kbd className="kbd-command-trigger shrink-0">{mod}K</kbd>
    </motion.button>
  );
}
