"use client";

import { AnimatePresence, motion, type Transition } from "framer-motion";
import {
  Bot,
  Bug,
  ChevronRight,
  Plus,
  StickyNote,
  Target,
  Wallet,
  Zap,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { triggerHaptic } from "@/lib/haptic";
import { useEscape } from "@/lib/hooks/use-escape";
import { cn } from "@/lib/utils";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type QuickActionId =
  | "askAi"
  | "antExpense"
  | "quickExpense"
  | "income"
  | "goal"
  | "quickNote";

const FAB_SPRING: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 20,
};

const PILL_SPRING: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 28,
};

const PILL_INTERACTION = { duration: 0.15, ease: "easeOut" as const };
const PILL_TAP = { duration: 0.1, ease: "easeOut" as const };
const SELECT_DELAY_MS = 150;
const STAGGER = 0.06;

/** Top → bottom in the column; stagger runs bottom-up (closest to FAB first). */
const ACTIONS: {
  id: QuickActionId;
  icon: typeof Bug;
}[] = [
  { id: "askAi", icon: Bot },
  { id: "quickNote", icon: StickyNote },
  { id: "goal", icon: Target },
  { id: "income", icon: Wallet },
  { id: "quickExpense", icon: Zap },
  { id: "antExpense", icon: Bug },
];

type QuickActionFabProps = {
  onSelect: (id: QuickActionId) => void;
  className?: string;
  /** Desktop keyboard hints shown on hover (e.g. from useModKeyLabel). */
  shortcutHints?: Partial<Record<QuickActionId, string>>;
};

type FabActionPillProps = {
  action: (typeof ACTIONS)[number];
  label: string;
  index: number;
  isSelecting: boolean;
  selectedId: QuickActionId | null;
  onSelect: (id: QuickActionId) => void;
  onPillKeyDown: (e: KeyboardEvent<HTMLButtonElement>, index: number) => void;
  pillRef: (el: HTMLButtonElement | null) => void;
  shortcutHint?: string;
};

function FabActionPill({
  action,
  label,
  index,
  isSelecting,
  selectedId,
  onSelect,
  onPillKeyDown,
  pillRef,
  shortcutHint,
}: FabActionPillProps) {
  const Icon = action.icon;
  const isSelected = selectedId === action.id;
  const isOther = isSelecting && !isSelected;

  const core = (
    <motion.button
      type="button"
      ref={pillRef}
      initial={{ opacity: 0, y: 16, scale: 0.85 }}
      animate={{
        opacity: isOther ? 0 : 1,
        y: 0,
        scale: isSelecting && isSelected ? 0.95 : 1,
      }}
      exit={{ opacity: 0, y: 16, scale: 0.85 }}
      transition={{
        ...PILL_SPRING,
        delay: isSelecting ? 0 : (ACTIONS.length - 1 - index) * STAGGER,
        opacity: isOther ? { duration: 0.1 } : undefined,
        scale: isSelecting && isSelected ? PILL_TAP : PILL_INTERACTION,
      }}
      whileHover={!isSelecting ? { scale: 1.03 } : undefined}
      whileTap={!isSelecting ? { scale: 0.95 } : undefined}
      onClick={() => onSelect(action.id)}
      onKeyDown={(e) => onPillKeyDown(e, index)}
      className={cn(
        "group flex min-h-11 min-w-[min(100%,280px)] cursor-pointer items-center gap-3 rounded-2xl border border-border-default bg-bg-modal px-5 py-3 text-sm font-medium text-text-primary shadow-md md:max-w-sm",
        "transition-[background-color,border-color,color] duration-150 ease-out",
        "hover:border-accent/40 hover:bg-bg-card-hover hover:text-accent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}>
      <Icon
        className="h-[18px] w-[18px] shrink-0 text-muted-foreground transition-colors duration-150 ease-out group-hover:text-accent"
        strokeWidth={2}
        aria-hidden
      />
      <span className="flex-1 text-left">{label}</span>
      <ChevronRight
        className="h-3 w-3 shrink-0 text-muted-foreground transition-[transform,color] duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-accent"
        strokeWidth={2}
        aria-hidden
      />
    </motion.button>
  );

  if (!shortcutHint) return core;

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{core}</TooltipTrigger>
      <TooltipContent side="left" align="center" className="font-mono text-xs">
        {shortcutHint}
      </TooltipContent>
    </Tooltip>
  );
}

export function QuickActionFab({
  onSelect,
  className,
  shortcutHints,
}: QuickActionFabProps) {
  const t = useTranslations("Finance.fab");
  const [open, setOpen] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedId, setSelectedId] = useState<QuickActionId | null>(null);
  const selectingRef = useRef(false);
  const pillRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const close = useCallback(() => {
    setOpen(false);
    setIsSelecting(false);
    setSelectedId(null);
    selectingRef.current = false;
  }, []);

  useEscape(close, open);

  useEffect(() => {
    if (!open || isSelecting) return;
    const id = requestAnimationFrame(() => pillRefs.current[0]?.focus());
    return () => cancelAnimationFrame(id);
  }, [open, isSelecting]);

  const focusPillAt = useCallback((index: number) => {
    const i = Math.max(0, Math.min(index, ACTIONS.length - 1));
    pillRefs.current[i]?.focus();
  }, []);

  const onPillKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (!open || isSelecting) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        focusPillAt(index + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        focusPillAt(index - 1);
      }
    },
    [open, isSelecting, focusPillAt],
  );

  const handleSelect = useCallback(
    (id: QuickActionId) => {
      if (selectingRef.current) return;
      triggerHaptic("medium");
      selectingRef.current = true;
      setSelectedId(id);
      setIsSelecting(true);

      window.setTimeout(() => {
        setOpen(false);
        setIsSelecting(false);
        setSelectedId(null);
        selectingRef.current = false;
        onSelect(id);
      }, SELECT_DELAY_MS);
    },
    [onSelect],
  );

  const fabExpanded = open && !isSelecting;

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.button
            key="fab-backdrop"
            type="button"
            aria-label={t("closeMenu")}
            className="fixed inset-0 z-40 cursor-pointer surface-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: isSelecting ? 0 : 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: isSelecting ? 0.1 : 0.2 }}
            onClick={isSelecting ? undefined : close}
          />
        ) : null}
      </AnimatePresence>

      <motion.div
        className={cn(
          "fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-4 z-50 flex flex-col items-end gap-3 md:bottom-8 md:right-8",
          className,
        )}
        layout>
        <AnimatePresence>
          {open
            ? ACTIONS.map((action, index) => (
                <FabActionPill
                  key={action.id}
                  action={action}
                  label={t(action.id)}
                  index={index}
                  isSelecting={isSelecting}
                  selectedId={selectedId}
                  onSelect={handleSelect}
                  onPillKeyDown={onPillKeyDown}
                  shortcutHint={shortcutHints?.[action.id]}
                  pillRef={(el) => {
                    pillRefs.current[index] = el;
                  }}
                />
              ))
            : null}
        </AnimatePresence>

        <motion.button
          type="button"
          layout
          className="flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-accent text-accent-foreground shadow-lg"
          onClick={() => {
            if (isSelecting) return;
            setOpen((prev) => {
              const next = !prev;
              if (next) triggerHaptic("light");
              return next;
            });
          }}
          aria-expanded={open}
          aria-label={open ? t("closeMenu") : t("openMenu")}
          aria-haspopup="menu"
          whileTap={{ scale: 0.95 }}
          transition={PILL_TAP}>
          <motion.span
            animate={{ rotate: fabExpanded ? 45 : 0 }}
            transition={FAB_SPRING}>
            <Plus className="h-6 w-6" strokeWidth={2.25} aria-hidden />
          </motion.span>
        </motion.button>
      </motion.div>
    </>
  );
}
