"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { FinanceHeaderUserMenu } from "@/components/finance/FinanceHeaderUserMenu";
import { FinanceNavIcon } from "@/components/finance/FinanceNavIcon";
import type { FinanceNavKey } from "@/components/finance/finance-nav-config";
import { SidebarBrand } from "@/components/finance/SidebarBrand";
import { ThemeCycleToggle } from "@/components/shared/theme-toggle";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { FinanceShellUser } from "@/contexts/finance-shell-user-context";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function FinanceMobileTopBar({
  user,
  sheetLinks,
  onNavClick,
}: {
  user: FinanceShellUser;
  sheetLinks: {
    key: FinanceNavKey;
    label: string;
    href: string;
    active: boolean;
  }[];
  onNavClick: (key: FinanceNavKey) => void;
}) {
  const t = useTranslations("Finance.nav");
  const [open, setOpen] = useState(false);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-30 flex shrink-0 items-center justify-between gap-3 border-b border-border-default bg-bg-app/95 py-3 pl-4 pr-3 backdrop-blur-md",
          "pt-[max(0.75rem,env(safe-area-inset-top))] md:hidden",
        )}>
        <SidebarBrand
          userId={user.id}
          collapsed={false}
          className="mb-0 min-w-0 flex-1"
        />
        <div className="flex shrink-0 items-center gap-1">
          <FinanceHeaderUserMenu
            email={user.email}
            fullName={user.fullName}
            avatarUrl={user.avatarUrl}
            compact
          />
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-text-primary transition-colors",
              "hover:bg-bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            )}
            aria-expanded={open}
            aria-label={t("openNavigationMenu")}>
            <Menu className="h-6 w-6" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-full max-w-sm flex-col gap-0 p-0">
          <SheetHeader className="border-b border-border-subtle px-6 py-4 text-left">
            <SheetTitle>{t("navSheetTitle")}</SheetTitle>
          </SheetHeader>
          <nav className="touch-scroll flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
            {sheetLinks.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                prefetch
                onClick={() => {
                  onNavClick(item.key);
                  setOpen(false);
                }}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                  item.active
                    ? "bg-accent-muted text-accent"
                    : "text-text-primary hover:bg-bg-card-hover",
                )}>
                <FinanceNavIcon name={item.key} />
                <span className="min-w-0 truncate">{item.label}</span>
              </Link>
            ))}
          </nav>
          <div className="border-t border-border-subtle px-6 py-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
              {t("appearance")}
            </p>
            <ThemeCycleToggle collapsed />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
