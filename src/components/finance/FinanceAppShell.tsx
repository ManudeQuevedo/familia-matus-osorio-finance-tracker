"use client";

import {
  AlertCircle,
  BarChart3,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Home,
  Menu,
  Settings,
  StickyNote,
  Target,
  TrendingUp,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState, useTransition } from "react";

import { AppQuickActions } from "@/components/finance/AppQuickActions";
import { SidebarBrand } from "@/components/finance/SidebarBrand";
import { ThemeCycleToggle } from "@/components/shared/theme-toggle";
import { UserAvatar } from "@/components/finance/UserAvatar";
import { useUserPreferences } from "@/components/providers/UserPreferencesProvider";
import { Link, usePathname } from "@/i18n/navigation";
import { getDisplayName } from "@/lib/finance/display-name";
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

type NavKey =
  | "dashboard"
  | "expenses"
  | "incomes"
  | "goals"
  | "debts"
  | "reports"
  | "ai"
  | "notes"
  | "settings"
  | "more";

const pathByKey: Record<NavKey, string> = {
  dashboard: "/dashboard",
  expenses: "/expenses",
  incomes: "/incomes",
  goals: "/goals",
  debts: "/debts",
  reports: "/reports",
  ai: "/ai",
  notes: "/notes",
  settings: "/settings",
  more: "/more",
};

function NavIcon({ name }: { name: NavKey }) {
  const cls = "h-5 w-5 shrink-0";
  switch (name) {
    case "dashboard":
      return <Home className={cls} />;
    case "expenses":
      return <CreditCard className={cls} />;
    case "incomes":
      return <TrendingUp className={cls} />;
    case "goals":
      return <Target className={cls} />;
    case "debts":
      return <AlertCircle className={cls} />;
    case "reports":
      return <BarChart3 className={cls} />;
    case "ai":
      return <BrainCircuit className={cls} />;
    case "notes":
      return <StickyNote className={cls} />;
    case "settings":
      return <Settings className={cls} />;
    case "more":
      return <Menu className={cls} />;
    default:
      return <Home className={cls} />;
  }
}

export type FinanceShellUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
};

function SidebarNavLink({
  item,
  href,
  active,
  collapsed,
  className,
  onNavigate,
}: {
  item: { key: NavKey; label: string };
  href: string;
  active: boolean;
  collapsed: boolean;
  className?: string;
  onNavigate?: (key: NavKey) => void;
}) {
  const link = (
    <Link
      href={href}
      prefetch
      onClick={() => onNavigate?.(item.key)}
      className={cn(
        "nav-item flex items-center py-2.5 text-sm font-medium",
        collapsed ? "justify-center px-2" : "gap-3 px-3",
        active && "nav-item-active",
        active && collapsed && "nav-item-collapsed",
        className,
      )}>
      <NavIcon name={item.key} />
      {!collapsed ? <span>{item.label}</span> : null}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
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
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onToggle}
          aria-label={label}
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
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

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
  const { avatarUrl } = useUserPreferences();

  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [optimisticKey, setOptimisticKey] = useState<NavKey | null>(null);
  const [, startTransition] = useTransition();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const stored = getUserPref(SIDEBAR_COLLAPSED_STORAGE_BASE, user.id);
    if (stored === "true") setCollapsed(true);
    setHydrated(true);
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

  const isPathActive = (key: NavKey) => {
    const href = pathByKey[key];
    if (key === "dashboard") {
      return pathWithoutLocale === href || pathWithoutLocale === "/";
    }
    return (
      pathWithoutLocale === href || pathWithoutLocale.startsWith(`${href}/`)
    );
  };

  const isActive = (key: NavKey) =>
    optimisticKey !== null ? optimisticKey === key : isPathActive(key);

  const onNavClick = useCallback((key: NavKey) => {
    setOptimisticKey(key);
  }, []);

  const displayName = getDisplayName(
    user.fullName,
    user.email,
    t("you") as string,
  );

  const initials = (() => {
    const src = user.fullName?.trim() || user.email || displayName;
    const parts = src.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
    }
    return src.slice(0, 2).toUpperCase();
  })();

  const navItems: { key: NavKey; label: string; mobileTab?: boolean }[] = [
    { key: "dashboard", label: t("dashboard"), mobileTab: true },
    { key: "expenses", label: t("expenses"), mobileTab: true },
    { key: "incomes", label: t("incomes"), mobileTab: true },
    { key: "goals", label: t("goals"), mobileTab: true },
    { key: "debts", label: t("debts") },
    { key: "reports", label: t("reports") },
    { key: "ai", label: t("ai") },
    { key: "notes", label: t("notes") },
    { key: "settings", label: t("settings") },
  ];

  const mobileTabs = [
    ...navItems.filter((i) => i.mobileTab),
    { key: "more" as const, label: t("more"), mobileTab: true },
  ];

  const sidebarCollapsed = hydrated && collapsed;

  const sidebarTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.3, ease: "easeInOut" as const };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex min-h-dvh overflow-x-visible bg-bg-app text-text-primary">
        <motion.aside
          className={cn(
            "sticky top-0 z-30 hidden h-dvh shrink-0 overflow-visible border-r border-border-default bg-bg-sidebar shadow-sm",
            "relative md:flex",
          )}
          initial={false}
          animate={{
            width: sidebarCollapsed ? "4rem" : "15rem",
          }}
          transition={sidebarTransition}>
          <div
            className={cn(
              "flex h-full min-h-0 flex-col overflow-hidden md:py-4",
              "transition-[padding] duration-300 ease-in-out",
              sidebarCollapsed ? "md:px-2" : "md:px-4",
            )}>
            <SidebarBrand userId={user.id} collapsed={sidebarCollapsed} />
            <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
              {navItems.map((item) => (
                <SidebarNavLink
                  key={item.key}
                  item={item}
                  href={pathByKey[item.key]}
                  active={isActive(item.key)}
                  collapsed={sidebarCollapsed}
                  onNavigate={onNavClick}
                  className={item.key === "settings" ? "mt-auto" : undefined}
                />
              ))}
            </nav>
            <div className="mt-4 hidden shrink-0 flex-col border-t border-border-subtle pt-4 md:flex">
              <div
                className={cn(
                  "mb-2 flex",
                  sidebarCollapsed ? "justify-center" : "items-center",
                )}>
                <ThemeCycleToggle collapsed={sidebarCollapsed} />
              </div>
              {sidebarCollapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex justify-center py-2">
                      <UserAvatar
                        avatarUrl={avatarUrl}
                        initials={initials}
                        size="sm"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p className="font-medium">{displayName}</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <div className="flex items-center gap-3 rounded-lg px-1 py-2">
                  <UserAvatar
                    avatarUrl={avatarUrl}
                    initials={initials}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {displayName}
                    </p>
                    {user.email ? (
                      <p className="truncate text-xs text-text-muted">
                        {user.email}
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>
          <SidebarCollapseTab
            collapsed={sidebarCollapsed}
            onToggle={toggleCollapsed}
            expandLabel={t("sidebarExpand")}
            collapseLabel={t("sidebarCollapse")}
          />
        </motion.aside>

        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0",
            "transition-[margin,padding] duration-300 ease-in-out",
          )}>
          <div className="flex items-center justify-end border-b border-border-default bg-bg-sidebar px-4 py-2 shadow-sm md:hidden">
            <ThemeCycleToggle collapsed />
          </div>
          {children}
        </div>

        <AppQuickActions />

        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border-default bg-bg-sidebar pb-[env(safe-area-inset-bottom)] shadow-sm md:hidden">
          <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1">
            {mobileTabs.map((item) => {
              const active = isActive(item.key);
              return (
                <Link
                  key={item.key}
                  href={pathByKey[item.key]}
                  prefetch
                  onClick={() => onNavClick(item.key)}
                  className={cn(
                    "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[10px] font-medium sm:text-xs",
                    active ? "font-medium text-accent" : "text-text-muted",
                  )}>
                  <NavIcon name={item.key} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </TooltipProvider>
  );
}
