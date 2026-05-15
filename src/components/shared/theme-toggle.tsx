"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useLocale } from "next-intl";
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
}: {
  className?: string;
  collapsed?: boolean;
  serverTheme?: ThemePreference;
}) {
  const locale = useLocale();
  const { displayTheme, setTheme } = useThemePreference(serverTheme);
  const { playRipple } = useThemeRipple();

  const Icon =
    displayTheme === "light" ? Sun : displayTheme === "dark" ? Moon : Monitor;
  const label =
    displayTheme === "light"
      ? "Light"
      : displayTheme === "dark"
        ? "Dark"
        : "System";

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    const current = displayTheme ?? "system";
    const next = cycleThemePreference(current);
    playRipple(event, next, () => {
      void setTheme(next, locale);
    });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size={collapsed ? "icon" : "sm"}
      className={cn(
        "text-text-muted hover:text-text-primary hover:text-text-primary",
        !collapsed && "w-full justify-start gap-2",
        className,
      )}
      onClick={handleClick}
      aria-label={`Theme: ${label}. Click to change.`}
      suppressHydrationWarning>
      <Icon className="h-4 w-4 shrink-0" />
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
          : "border-border-default bg-bg-card text-text-secondary hover:border-border-strong dark:border-border-default bg-bg-card dark:text-text-muted",
      )}>
      <Icon className="h-6 w-6" />
      {label}
    </button>
  );
}
