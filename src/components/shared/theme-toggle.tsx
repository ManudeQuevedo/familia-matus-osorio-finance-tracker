"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

import {
  cycleThemePreference,
  useThemePreference,
  type ThemePreference,
} from "@/components/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SIDEBAR_COLLAPSE_MOTION } from "@/components/finance/sidebar-collapse-motion";
import { cn } from "@/lib/utils";

const RIPPLE_DURATION = 0.5;
const RIPPLE_EASE: [number, number, number, number] = [0.76, 0, 0.24, 1];

type RippleState = {
  x: number;
  y: number;
  colorClass: string;
};

function resolvedAppearance(next: ThemePreference): "light" | "dark" {
  if (next === "dark") return "dark";
  if (next === "light") return "light";
  if (typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return "light";
}

function overlayColorClass(next: ThemePreference): string {
  return resolvedAppearance(next) === "dark" ? "bg-zinc-950" : "bg-bg-card";
}

type ThemeRippleContextValue = {
  playRipple: (
    event: MouseEvent,
    next: ThemePreference,
    onThemeChange: () => void,
  ) => void;
};

const ThemeRippleContext = createContext<ThemeRippleContextValue | null>(null);

function useThemeRipple() {
  const ctx = useContext(ThemeRippleContext);
  if (!ctx) {
    throw new Error("useThemeRipple must be used within ThemeRippleProvider");
  }
  return ctx;
}

export function ThemeRippleProvider({ children }: { children: ReactNode }) {
  const [ripple, setRipple] = useState<RippleState | null>(null);

  const playRipple = useCallback(
    (event: MouseEvent, next: ThemePreference, onThemeChange: () => void) => {
      const x = event.clientX;
      const y = event.clientY;
      setRipple({ x, y, colorClass: overlayColorClass(next) });
      onThemeChange();
    },
    [],
  );

  const clearRipple = useCallback(() => {
    setRipple(null);
  }, []);

  return (
    <ThemeRippleContext.Provider value={{ playRipple }}>
      <div className="relative">
        <AnimatePresence>
          {ripple ? (
            <motion.div
              key={`${ripple.x}-${ripple.y}`}
              className={ripple.colorClass}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: -1,
                pointerEvents: "none",
              }}
              initial={{
                clipPath: `circle(0px at ${ripple.x}px ${ripple.y}px)`,
              }}
              animate={{
                clipPath: `circle(150% at ${ripple.x}px ${ripple.y}px)`,
              }}
              exit={{
                opacity: 0,
                transition: { duration: 0.15, ease: "easeOut" },
              }}
              transition={{ duration: RIPPLE_DURATION, ease: RIPPLE_EASE }}
              onAnimationComplete={clearRipple}
              aria-hidden
            />
          ) : null}
        </AnimatePresence>
        <div className="relative z-1">{children}</div>
      </div>
    </ThemeRippleContext.Provider>
  );
}

export function ThemeCycleToggle({
  className,
  collapsed,
  serverTheme = "system",
  appearance = "toolbar",
  prefersReducedMotion: prefersReducedMotionProp,
}: {
  className?: string;
  collapsed?: boolean;
  serverTheme?: ThemePreference;
  appearance?: "toolbar" | "sidebar";
  /** When omitted, uses `useReducedMotion()` (sidebar appearance only reads this when passed from shell). */
  prefersReducedMotion?: boolean;
}) {
  const reducedMotionHook = useReducedMotion();
  const prefersReducedMotion =
    prefersReducedMotionProp ?? reducedMotionHook === true;
  const locale = useLocale();
  const tPrefs = useTranslations("Finance.settings.preferences");
  const { displayTheme, setTheme } = useThemePreference(serverTheme);
  const { playRipple } = useThemeRipple();

  const Icon: LucideIcon =
    displayTheme === "light" ? Sun : displayTheme === "dark" ? Moon : Monitor;
  const label =
    displayTheme === "light"
      ? tPrefs("themeLight")
      : displayTheme === "dark"
        ? tPrefs("themeDark")
        : tPrefs("themeSystem");

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    const current = displayTheme ?? "system";
    const next = cycleThemePreference(current);
    playRipple(event, next, () => {
      void setTheme(next, locale);
    });
  };

  const isCollapsedSidebar = !!collapsed && appearance === "sidebar";

  if (appearance === "sidebar") {
    const sidebarButton = (
      <button
        type="button"
        className={cn(
          "nav-item flex min-w-0 items-center overflow-hidden whitespace-nowrap rounded-lg py-2.5 text-sm font-medium transition-[gap,padding] duration-300 ease-in-out",
          "text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          collapsed ? "w-full justify-center px-2" : "gap-3 px-3",
          className,
        )}
        onClick={handleClick}
        aria-label={`${tPrefs("theme")}: ${label}`}
        suppressHydrationWarning>
        <Icon className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
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
          aria-hidden={collapsed}
          suppressHydrationWarning>
          {label}
        </motion.span>
      </button>
    );

    return (
      <Tooltip
        delayDuration={250}
        {...(!isCollapsedSidebar ? { open: false as boolean } : {})}>
        <TooltipTrigger asChild>{sidebarButton}</TooltipTrigger>
        {isCollapsedSidebar ? (
          <TooltipContent side="right">{label}</TooltipContent>
        ) : null}
      </Tooltip>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size={collapsed ? "icon" : "sm"}
      className={cn(
        "text-text-muted hover:text-text-primary",
        !collapsed && "w-full justify-start gap-2",
        className,
      )}
      onClick={handleClick}
      aria-label={`${tPrefs("theme")}: ${label}`}
      suppressHydrationWarning>
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {!collapsed ? (
        <span className="text-sm" suppressHydrationWarning>
          {label}
        </span>
      ) : null}
    </Button>
  );
}

export function ThemePreferenceOption({
  value,
  label,
  Icon,
  active,
  disabled,
  onSelect,
}: {
  value: ThemePreference;
  label: string;
  Icon: LucideIcon;
  active: boolean;
  disabled?: boolean;
  onSelect: (value: ThemePreference) => void;
}) {
  const { playRipple } = useThemeRipple();

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (disabled || active) return;
    playRipple(event, value, () => {
      onSelect(value);
    });
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border px-4 py-4 text-sm font-medium transition",
        active
          ? "border-accent bg-accent-muted text-accent ring-2 ring-accent/30"
          : "border-border-default bg-bg-card text-text-secondary hover:border-border-strong dark:border-border-default dark:text-text-muted",
      )}>
      <Icon className="h-6 w-6" />
      {label}
    </button>
  );
}
