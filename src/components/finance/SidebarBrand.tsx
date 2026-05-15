"use client";

import { motion } from "framer-motion";
import { createElement, useEffect, useRef, useState } from "react";

import { SIDEBAR_COLLAPSE_MOTION } from "@/components/finance/sidebar-collapse-motion";
import {
  getSidebarIcon,
  isSidebarIconId,
  SIDEBAR_ICON_OPTIONS,
  type SidebarIconId,
} from "@/lib/finance/sidebar-icon";
import {
  getUserPref,
  setUserPref,
  SIDEBAR_ICON_STORAGE_BASE,
} from "@/lib/storage/user-preferences-storage";
import { cn } from "@/lib/utils";

const FAMILY_NAME = "Familia Matus Osorio";

export function SidebarBrand({
  userId,
  collapsed,
  prefersReducedMotion,
  className,
}: {
  userId: string;
  collapsed: boolean;
  prefersReducedMotion?: boolean;
  className?: string;
}) {
  const [iconId, setIconId] = useState<SidebarIconId>("home");
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    queueMicrotask(() => {
      const stored = getUserPref(SIDEBAR_ICON_STORAGE_BASE, userId);
      if (stored && isSidebarIconId(stored)) {
        setIconId(stored);
      }
    });
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const pickIcon = (id: SidebarIconId) => {
    setIconId(id);
    setUserPref(SIDEBAR_ICON_STORAGE_BASE, userId, id);
    setOpen(false);
  };

  return (
    <div
      className={cn(
        "relative mb-6 flex min-w-0 items-center overflow-hidden whitespace-nowrap",
        collapsed ? "justify-center px-0" : "gap-2 px-1",
        className,
      )}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-white shadow-sm transition hover:opacity-90"
        aria-label="Change sidebar icon"
        aria-expanded={open}>
        {createElement(getSidebarIcon(iconId), { className: "h-5 w-5" })}
      </button>
      <motion.span
        className={cn(
          "min-w-0 overflow-hidden text-sm font-semibold leading-tight tracking-tight",
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
        {FAMILY_NAME}
      </motion.span>
      {open ? (
        <div
          ref={popoverRef}
          className={cn(
            "absolute z-50 rounded-xl border border-border-default bg-bg-card p-2 shadow-lg dark:border-border-default",
            collapsed
              ? "left-full top-0 ml-2 w-52"
              : "left-0 top-full mt-2 w-full min-w-48",
          )}>
          <div className="grid grid-cols-5 gap-1" role="listbox">
            {SIDEBAR_ICON_OPTIONS.map(({ id, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => pickIcon(id)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg transition",
                  iconId === id
                    ? "bg-accent-muted text-accent"
                    : "text-text-secondary hover:bg-bg-card-hover dark:text-text-muted",
                )}
                aria-label={id}>
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
