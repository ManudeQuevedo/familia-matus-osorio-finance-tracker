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
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

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
};

type FabActionPillProps = {
  action: (typeof ACTIONS)[number];
  label: string;
  index: number;
  isSelecting: boolean;
  selectedId: QuickActionId | null;
  onSelect: (id: QuickActionId) => void;
};

function FabActionPill({
  action,
  label,
  index,
  isSelecting,
  selectedId,
  onSelect,
}: FabActionPillProps) {
  const Icon = action.icon;
  const isSelected = selectedId === action.id;
  const isOther = isSelecting && !isSelected;

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 16, scale: 0.85 }}
      animate={{
        opacity: isOther ? 0 : 1,
        y: 0,
        scale: isSelecting && isSelected ? 0.97 : 1,
      }}
      exit={{ opacity: 0, y: 16, scale: 0.85 }}
      transition={{
        ...PILL_SPRING,
        delay: isSelecting ? 0 : (ACTIONS.length - 1 - index) * STAGGER,
        opacity: isOther ? { duration: 0.1 } : undefined,
        scale: isSelecting && isSelected ? PILL_TAP : PILL_INTERACTION,
      }}
      whileHover={!isSelecting ? { scale: 1.03 } : undefined}
      whileTap={!isSelecting ? { scale: 0.97 } : undefined}
      onClick={() => onSelect(action.id)}
      className={cn(
        "group flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-border-default bg-bg-modal px-5 py-3 text-sm font-medium text-text-primary shadow-md",
        "transition-[background-color,border-color,color] duration-150 ease-out",
        "hover:border-accent/40 hover:bg-bg-card-hover hover:text-accent",
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
}

export function QuickActionFab({ onSelect, className }: QuickActionFabProps) {
  const t = useTranslations("Finance.fab");
  const [open, setOpen] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedId, setSelectedId] = useState<QuickActionId | null>(null);
  const selectingRef = useRef(false);

  const close = useCallback(() => {
    setOpen(false);
    setIsSelecting(false);
    setSelectedId(null);
    selectingRef.current = false;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        close();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, close]);

  const handleSelect = useCallback(
    (id: QuickActionId) => {
      if (selectingRef.current) return;
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
          "fixed bottom-20 right-4 z-50 flex flex-col items-end gap-3 md:bottom-8 md:right-8",
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
            setOpen((prev) => !prev);
          }}
          aria-expanded={open}
          aria-label={open ? t("closeMenu") : t("openMenu")}
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
