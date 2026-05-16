"use client";

import { Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  ariaLabel: string;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
  /** Toolbar / header: keep trash visible on desktop too (still ≥44px on mobile). */
  alwaysVisible?: boolean;
};

/**
 * Desktop: icon appears when hovering the parent with `.group`.
 * Mobile (`max-md`): always visible with ≥44px touch target.
 */
export function RowDeleteButton({
  ariaLabel,
  onClick,
  className,
  alwaysVisible,
}: Props) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md",
        "text-muted-foreground transition-[opacity,color] duration-[150ms] hover:text-red-500",
        "min-h-11 min-w-11 md:min-h-8 md:min-w-8 md:p-1",
        alwaysVisible
          ? "opacity-100 md:pointer-events-auto"
          : "opacity-100 md:pointer-events-none md:opacity-0 md:group-hover:pointer-events-auto md:group-hover:opacity-100",
        className,
      )}>
      <Trash2 className="h-[15px] w-[15px]" aria-hidden />
    </button>
  );
}
