"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  AnimatePresence,
  motion,
  type PanInfo,
  useDragControls,
} from "framer-motion";
import { X } from "lucide-react";
import * as React from "react";

import { triggerHaptic } from "@/lib/haptic";
import { cn } from "@/lib/utils";

type AnimatedBottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

export function AnimatedBottomSheet({
  open,
  onOpenChange,
  title,
  children,
  footer,
  className,
}: AnimatedBottomSheetProps) {
  const dragControls = useDragControls();

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 400) {
      triggerHaptic("light");
      onOpenChange(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                role="presentation"
                className="fixed inset-0 z-50 surface-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onPointerDown={() => onOpenChange(false)}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content
              asChild
              forceMount
              onEscapeKeyDown={(e) => e.preventDefault()}>
              <motion.div
                className={cn(
                  "surface-sheet-bottom fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col outline-none",
                  className,
                )}
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                drag="y"
                dragControls={dragControls}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.2 }}
                onDragEnd={onDragEnd}>
                <motion.div
                  className="drag-handle mx-auto mt-3 mb-1 h-1 w-8 shrink-0 cursor-grab rounded-[2px] bg-border-strong active:cursor-grabbing"
                  onPointerDown={(e) => dragControls.start(e)}
                />
                <motion.div
                  className="flex items-center justify-between gap-2 px-4 pb-2 pt-1"
                  onPointerDown={(e) => dragControls.start(e)}>
                  {title ? (
                    <DialogPrimitive.Title className="text-lg font-semibold text-text-primary">
                      {title}
                    </DialogPrimitive.Title>
                  ) : (
                    <span />
                  )}
                  <DialogPrimitive.Close className="flex h-11 min-h-11 min-w-11 items-center justify-center rounded-full opacity-70 hover:bg-bg-card-hover hover:opacity-100">
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </DialogPrimitive.Close>
                </motion.div>
                <motion.div
                  className="touch-scroll flex-1 overflow-y-auto px-4 pb-4"
                  onPointerDown={(e) => e.stopPropagation()}>
                  {children}
                </motion.div>
                {footer ? (
                  <div className="border-t border-border-default px-4 py-4">
                    {footer}
                  </div>
                ) : null}
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
