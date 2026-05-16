"use client";

import { type DialogProps } from "@radix-ui/react-dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command as CommandPrimitive } from "cmdk";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { Search } from "lucide-react";
import * as React from "react";

import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const genieVariants: Variants = {
  hidden: {
    opacity: 0,
    scaleX: 0.3,
    scaleY: 0.1,
    y: -40,
    filter: "blur(4px)",
  },
  visible: {
    opacity: 1,
    scaleX: 1,
    scaleY: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.35,
      ease: [0.34, 1.56, 0.64, 1],
      scaleX: { duration: 0.25, ease: [0.34, 1.2, 0.64, 1] },
      scaleY: { duration: 0.35, ease: [0.34, 1.56, 0.64, 1] },
      opacity: { duration: 0.15 },
      filter: { duration: 0.2 },
    },
  },
  exit: {
    opacity: 0,
    scaleX: 0.3,
    scaleY: 0.05,
    y: -30,
    filter: "blur(4px)",
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 1, 1],
      scaleY: { duration: 0.15 },
    },
  },
};

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "command-menu-root flex h-full w-full flex-col overflow-hidden rounded-2xl bg-transparent text-text-primary",
      "**:[[cmdk-group-heading]]:px-4 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-[11px] **:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-heading]]:tracking-wide **:[[cmdk-group-heading]]:text-text-muted",
      "[&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0",
      "[&_[cmdk-input-wrapper]_svg]:mx-4 [&_[cmdk-input-wrapper]_svg]:my-5 [&_[cmdk-input-wrapper]_svg]:size-5 [&_[cmdk-input-wrapper]_svg]:shrink-0 [&_[cmdk-input-wrapper]_svg]:text-text-muted",
      "**:[[cmdk-item]]:px-3 **:[[cmdk-item]]:py-0 [&_[cmdk-item]_svg]:size-4 [&_[cmdk-item]_svg]:shrink-0",
      "[&_[cmdk-item]_svg]:text-text-muted [&_[cmdk-item][aria-selected=true]_svg]:text-accent",
      className,
    )}
    {...props}
  />
));
Command.displayName = CommandPrimitive.displayName;

type CommandDialogProps = DialogProps & {};

const CommandDialog = ({
  children,
  contentClassName,
  open,
  ...props
}: CommandDialogProps & { contentClassName?: string }) => {
  const showPanel = Boolean(open);

  return (
    <Dialog open={open} {...props}>
      <DialogPortal>
        <DialogOverlay forceMount className="command-dialog-backdrop" />
        <DialogPrimitive.Content
          forceMount
          className={cn(
            "fixed left-1/2 top-[20%] z-50 grid max-h-[70dvh] w-[calc(100vw-2rem)] max-w-[560px] -translate-x-1/2 gap-0 overflow-visible border-0 bg-transparent p-0 shadow-none outline-none",
            !showPanel && "pointer-events-none",
            contentClassName,
          )}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
          }}>
          <AnimatePresence mode="wait">
            {showPanel ? (
              <motion.div
                key="command-dialog-panel"
                variants={genieVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                style={{ transformOrigin: "top center" }}
                className="command-dialog-panel flex max-h-[70dvh] min-h-0 w-full flex-col overflow-hidden">
                {children}
              </motion.div>
            ) : null}
          </AnimatePresence>
          <DialogPrimitive.Close
            tabIndex={-1}
            className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0"
            aria-hidden>
            Close
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
};
CommandDialog.displayName = "CommandDialog";

const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div
    role="presentation"
    className="flex items-center border-b border-border-subtle px-0"
    cmdk-input-wrapper="">
    <Search aria-hidden />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "flex h-14 w-full border-0 bg-transparent py-4 pr-4 text-[16px] leading-none",
        "text-text-primary placeholder:text-text-muted disabled:cursor-not-allowed disabled:opacity-50",
        "focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
        "border-none outline-none shadow-none",
        className,
      )}
      {...props}
    />
  </div>
));
CommandInput.displayName = CommandPrimitive.Input.displayName;

const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn(
      "max-h-[min(340px,calc(70dvh-5rem))] touch-scroll overflow-x-hidden overflow-y-auto p-2",
      className,
    )}
    {...props}
  />
));
CommandList.displayName = CommandPrimitive.List.displayName;

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className="flex min-h-[120px] items-center justify-center py-12 text-center text-sm text-text-muted"
    {...props}
  />
));
CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "overflow-hidden p-1 **:[[cmdk-group-heading]]:pointer-events-none",
      className,
    )}
    {...props}
  />
));
CommandGroup.displayName = CommandPrimitive.Group.displayName;

const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 h-px bg-border-subtle", className)}
    {...props}
  />
));
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex h-10 cursor-pointer select-none items-center rounded-lg px-3 text-sm font-medium outline-none",
      'gap-3 **:data-[slot="shortcut"]:shrink-0',
      "[&_svg:first-child]:size-4 [&_svg:first-child]:shrink-0 [&_svg:first-child]:text-text-muted aria-selected:[&_svg:first-child]:text-accent",
      "bg-transparent aria-selected:text-accent",
      "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
      className,
    )}
    {...props}
  />
));
CommandItem.displayName = CommandPrimitive.Item.displayName;

function CommandShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-slot="shortcut"
      className={cn(
        "ml-auto inline-flex shrink-0 items-center rounded-md border border-border-default bg-bg-badge px-1.5 py-px font-mono text-[11px] text-text-muted tabular-nums",
        className,
      )}
      {...props}
    />
  );
}
CommandShortcut.displayName = "CommandShortcut";

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
};
