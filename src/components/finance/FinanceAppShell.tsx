"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type Ref,
} from "react";

import { AppQuickActions } from "@/components/finance/AppQuickActions";
import { FINANCE_PATH_BY_KEY } from "@/components/finance/finance-nav-config";
import type { FinanceNavKey } from "@/components/finance/finance-nav-config";
import { FinanceMobileTopBar } from "@/components/finance/FinanceMobileTopBar";
import { FinanceNavIcon } from "@/components/finance/FinanceNavIcon";
import { SIDEBAR_COLLAPSE_MOTION } from "@/components/finance/sidebar-collapse-motion";
import { SidebarBrand } from "@/components/finance/SidebarBrand";
import {
  FinanceShellUserProvider,
  type FinanceShellUser,
} from "@/contexts/finance-shell-user-context";
import { ThemeCycleToggle } from "@/components/shared/theme-toggle";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { Link, usePathname } from "@/i18n/navigation";
import {
  getUserPref,
  setUserPref,
  SIDEBAR_COLLAPSED_STORAGE_BASE,
} from "@/lib/storage/user-preferences-storage";
import { cn } from "@/lib/utils";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function SidebarNavLink({
  item,
  href,
  active,
  collapsed,
  prefersReducedMotion,
  className,
  onNavigate,
  linkRef,
}: {
  item: { key: FinanceNavKey; label: string };
  href: string;
  active: boolean;
  collapsed: boolean;
  prefersReducedMotion: boolean;
  className?: string;
  onNavigate?: (key: FinanceNavKey) => void;
  linkRef?: Ref<HTMLAnchorElement>;
}) {
  const link = (
    <Link
      ref={linkRef}
      href={href}
      prefetch
      onClick={() => onNavigate?.(item.key)}
      className={cn(
        "nav-item flex min-h-11 min-w-0 items-center overflow-hidden whitespace-nowrap py-2.5 text-sm font-medium transition-[gap,padding] duration-300 ease-in-out",
        collapsed ? "justify-center px-2" : "gap-3 px-3",
        active && "nav-item-active",
        active && collapsed && "nav-item-collapsed",
        className,
      )}>
      <FinanceNavIcon name={item.key} />
      <motion.span
        className={cn(
          "min-w-0 overflow-hidden",
          collapsed ? "w-0 shrink-0 flex-none" : "flex-1",
        )}
        animate={{ opacity: collapsed ? 0 : 1 }}
        transition={{
          duration: prefersReducedMotion
            ? 0
            : SIDEBAR_COLLAPSE_MOTION.labelDuration,
          ease: SIDEBAR_COLLAPSE_MOTION.widthEase,
          delay: prefersReducedMotion
            ? 0
            : collapsed
              ? 0
              : SIDEBAR_COLLAPSE_MOTION.labelDelayExpand,
        }}
        style={{
          whiteSpace: "nowrap",
          overflow: "hidden",
          display: "block",
        }}
        aria-hidden={collapsed}>
        {item.label}
      </motion.span>
    </Link>
  );

  return (
    <Tooltip
      delayDuration={0}
      {...(!collapsed ? { open: false as boolean } : {})}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      {collapsed ? (
        <TooltipContent side="right">{item.label}</TooltipContent>
      ) : null}
    </Tooltip>
  );
}

function SidebarCollapseTab({
  collapsed,
  onToggle,
  expandLabel,
  collapseLabel,
}: {
  collapsed: boolean;
  onToggle: () => void;
  expandLabel: string;
  collapseLabel: string;
}) {
  const label = collapsed ? expandLabel : collapseLabel;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      className={cn(
        "absolute top-1/2 right-[-20px] z-50 flex h-12 w-5 -translate-y-1/2 cursor-pointer items-center justify-center",
        "rounded-r-lg border border-l-0 border-border-default bg-bg-sidebar",
        "text-text-muted shadow-sm",
        "transition-[background-color,color,box-shadow,transform] duration-300 ease-in-out",
        "hover:bg-bg-card-hover hover:text-accent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}>
      {collapsed ? (
        <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : (
        <ChevronLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
      )}
    </button>
  );
}

export type { FinanceShellUser } from "@/contexts/finance-shell-user-context";

export function FinanceAppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: FinanceShellUser;
}) {
  const pathname = usePathname() ?? "/";
  const locale = useLocale();
  const t = useTranslations("Finance.nav");
  const isDesktopViewport = useIsDesktop();

  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [optimisticKey, setOptimisticKey] = useState<FinanceNavKey | null>(
    null,
  );
  const [, startTransition] = useTransition();
  const reduceMotion = useReducedMotion();
  const navLinkRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    queueMicrotask(() => {
      const stored = getUserPref(SIDEBAR_COLLAPSED_STORAGE_BASE, user.id);
      if (stored === "true") setCollapsed(true);
      setHydrated(true);
    });
  }, [user.id]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      setUserPref(SIDEBAR_COLLAPSED_STORAGE_BASE, user.id, String(next));
      return next;
    });
  }, [user.id]);

  const pathWithoutLocale = (() => {
    const prefix = `/${locale}`;
    if (pathname === prefix || pathname === `${prefix}/`) return "/";
    if (pathname.startsWith(`${prefix}/`)) {
      const rest = pathname.slice(prefix.length) || "/";
      return rest.startsWith("/") ? rest : `/${rest}`;
    }
    return pathname.startsWith("/") ? pathname : `/${pathname}`;
  })();

  useEffect(() => {
    startTransition(() => setOptimisticKey(null));
  }, [pathname, startTransition]);

  const isPathActive = (key: FinanceNavKey) => {
    const href = FINANCE_PATH_BY_KEY[key];
    if (key === "dashboard") {
      return pathWithoutLocale === href || pathWithoutLocale === "/";
    }
    return (
      pathWithoutLocale === href || pathWithoutLocale.startsWith(`${href}/`)
    );
  };

  const isActive = (key: FinanceNavKey) =>
    optimisticKey !== null ? optimisticKey === key : isPathActive(key);

  const onSidebarNavKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (!isDesktopViewport) return;
      const links = navLinkRefs.current.filter((n): n is HTMLAnchorElement =>
        Boolean(n),
      );
      if (!links.length) return;
      const idx = links.findIndex((el) => el === document.activeElement);
      if (idx === -1) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        links[Math.min(idx + 1, links.length - 1)]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        links[Math.max(idx - 1, 0)]?.focus();
      }
    },
    [isDesktopViewport],
  );

  const onNavClick = useCallback((key: FinanceNavKey) => {
    setOptimisticKey(key);
  }, []);

  const navItems: { key: FinanceNavKey; label: string }[] = [
    { key: "dashboard", label: t("dashboard") },
    { key: "expenses", label: t("expenses") },
    { key: "incomes", label: t("incomes") },
    { key: "goals", label: t("goals") },
    { key: "debts", label: t("debts") },
    { key: "reports", label: t("reports") },
    { key: "ai", label: t("ai") },
    { key: "notes", label: t("notes") },
  ];

  const sheetLinks = [
    ...navItems.map((item) => ({
      key: item.key,
      label: item.label,
      href: FINANCE_PATH_BY_KEY[item.key],
      active: isActive(item.key),
    })),
    {
      key: "more" as const,
      label: t("more"),
      href: FINANCE_PATH_BY_KEY.more,
      active: isActive("more"),
    },
  ];

  const sidebarCollapsed = hydrated && collapsed;

  const prefersReducedMotion = reduceMotion === true;

  return (
    <TooltipProvider delayDuration={0}>
      <FinanceShellUserProvider user={user}>
        <div className="flex h-dvh max-h-dvh min-h-0 w-full overflow-hidden bg-bg-app text-text-primary">
          <motion.aside
            initial={false}
            animate={{
              width: sidebarCollapsed
                ? SIDEBAR_COLLAPSE_MOTION.widthCollapsedPx
                : SIDEBAR_COLLAPSE_MOTION.widthExpandedPx,
            }}
            transition={{
              duration: prefersReducedMotion
                ? 0
                : SIDEBAR_COLLAPSE_MOTION.widthDuration,
              ease: SIDEBAR_COLLAPSE_MOTION.widthEase,
            }}
            className={cn(
              "sticky top-0 z-40 hidden h-dvh shrink-0 border-r border-border-default bg-bg-sidebar shadow-sm md:flex",
              "relative min-w-0 overflow-visible",
            )}
            style={{ minWidth: 0 }}>
            <div
              className={cn(
                "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:py-4",
                "transition-[padding] duration-300 ease-in-out",
                sidebarCollapsed ? "md:px-2" : "md:px-4",
              )}>
              <SidebarBrand
                userId={user.id}
                collapsed={sidebarCollapsed}
                prefersReducedMotion={prefersReducedMotion}
              />
              <nav
                className="flex min-h-0 flex-1 touch-scroll flex-col gap-1 overflow-y-auto"
                onKeyDown={onSidebarNavKeyDown}>
                {navItems.map((item, index) => (
                  <SidebarNavLink
                    key={item.key}
                    item={item}
                    href={FINANCE_PATH_BY_KEY[item.key]}
                    active={isActive(item.key)}
                    collapsed={sidebarCollapsed}
                    prefersReducedMotion={prefersReducedMotion}
                    onNavigate={onNavClick}
                    linkRef={(el) => {
                      navLinkRefs.current[index] = el;
                    }}
                    className={item.key === "notes" ? "mt-auto" : undefined}
                  />
                ))}
              </nav>
              <div className="mt-4 hidden shrink-0 flex-col border-t border-border-subtle pt-4 md:flex">
                <div
                  className={cn(
                    sidebarCollapsed
                      ? "flex justify-center"
                      : "flex items-center",
                  )}>
                  <ThemeCycleToggle
                    collapsed={sidebarCollapsed}
                    appearance="sidebar"
                    prefersReducedMotion={prefersReducedMotion}
                  />
                </div>
              </div>
            </div>
            <SidebarCollapseTab
              collapsed={sidebarCollapsed}
              onToggle={toggleCollapsed}
              expandLabel={t("sidebarExpand")}
              collapseLabel={t("sidebarCollapse")}
            />
          </motion.aside>

          <main
            className={cn(
              "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
              "transition-[margin,padding] duration-300 ease-in-out",
            )}>
            <FinanceMobileTopBar
              user={user}
              sheetLinks={sheetLinks}
              onNavClick={onNavClick}
            />
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
              {children}
            </div>
          </main>

          <AppQuickActions />
        </div>
      </FinanceShellUserProvider>
    </TooltipProvider>
  );
}
