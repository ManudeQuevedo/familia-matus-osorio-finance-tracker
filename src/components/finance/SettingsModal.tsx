"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  AnimatePresence,
  motion,
  useDragControls,
  type PanInfo,
} from "framer-motion";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TAB_META,
  SettingsPanels,
} from "@/features/finance/settings/settings-panels";
import type { SettingsSnapshot } from "@/lib/finance/settings-queries";
import type { SettingsTab } from "@/contexts/settings-modal-context";
import { useSettingsModal } from "@/contexts/settings-modal-context";
import { useEscape } from "@/lib/hooks/use-escape";
import { triggerHaptic } from "@/lib/haptic";
import { cn } from "@/lib/utils";

function useMatchMobileModal() {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setMatches(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return matches;
}

export function SettingsModalHost({
  locale,
  initial,
  loadError,
}: {
  locale: string;
  initial: SettingsSnapshot | null;
  loadError: string | null;
}) {
  const { isOpen, closeSettings, activeTab, setActiveTab } = useSettingsModal();
  const t = useTranslations("Finance.settings.tabs");

  return (
    <AnimatePresence mode="wait">
      {isOpen ? (
        <motion.div
          key="settings-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}>
          <SettingsModalDialog
            locale={locale}
            initial={initial}
            loadError={loadError}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onClose={closeSettings}
            tabLabel={(id) => t(id)}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function SettingsModalDialog({
  locale,
  initial,
  loadError,
  activeTab,
  onTabChange,
  onClose,
  tabLabel,
}: {
  locale: string;
  initial: SettingsSnapshot | null;
  loadError: string | null;
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  onClose: () => void;
  tabLabel: (id: SettingsTab) => string;
}) {
  const tModal = useTranslations("Finance.settings");
  const isMobileLayout = useMatchMobileModal();
  const dragControls = useDragControls();

  useEscape(onClose, true);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (!isMobileLayout) return;
    if (info.offset.y > 88 || info.velocity.y > 420) {
      triggerHaptic("light");
      onClose();
    }
  };

  return (
    <DialogPrimitive.Root
      open
      modal
      onOpenChange={(open) => {
        if (!open) onClose();
      }}>
      <DialogPrimitive.Portal forceMount>
        <div className="fixed inset-0 z-100">
          <DialogPrimitive.Overlay
            forceMount
            className={cn(
              "fixed inset-0 bg-[rgba(0,0,0,0.6)] backdrop-blur-sm",
              "max-md:pointer-events-none max-md:bg-transparent max-md:backdrop-blur-none",
            )}
          />
          <DialogPrimitive.Content
            forceMount
            asChild
            onCloseAutoFocus={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
            onInteractOutside={(e) => {
              if (typeof window !== "undefined" && window.innerWidth < 768) {
                e.preventDefault();
              }
            }}
            onPointerDownOutside={(e) => {
              if (typeof window !== "undefined" && window.innerWidth < 768) {
                e.preventDefault();
              }
            }}>
            <motion.div
              drag={isMobileLayout ? "y" : false}
              dragListener={false}
              dragControls={dragControls}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.22 }}
              onDragEnd={onDragEnd}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{
                opacity: 0,
                scale: 0.96,
                transition: { duration: 0.2, ease: "easeOut" },
              }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className={cn(
                "fixed z-101 flex flex-col overflow-hidden bg-bg-modal shadow-2xl outline-none touch-scroll",
                "max-md:inset-0 max-md:left-0 max-md:top-0 max-md:h-dvh max-md:w-screen max-md:max-w-none max-md:translate-none max-md:rounded-none",
                "md:left-1/2 md:top-1/2 md:h-[80vh] md:max-h-[700px] md:w-[80vw] md:max-w-[1000px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[16px]",
              )}>
              <header
                onPointerDown={(e) => {
                  if (!isMobileLayout) return;
                  if ((e.target as HTMLElement).closest("button")) return;
                  dragControls.start(e);
                }}
                className={cn(
                  "relative flex h-[52px] shrink-0 items-center justify-center border-b border-border-subtle bg-bg-modal px-3",
                  isMobileLayout && "cursor-grab active:cursor-grabbing",
                )}>
                <DialogPrimitive.Title className="pointer-events-none text-sm font-semibold text-text-primary">
                  {tModal("modalTitle")}
                </DialogPrimitive.Title>
                <DialogPrimitive.Close asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={tModal("close")}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="absolute right-2 top-1/2 h-11 min-h-11 w-11 min-w-11 -translate-y-1/2 rounded-full max-md:touch-manipulation md:h-9 md:min-h-9 md:w-9 md:min-w-9">
                    <X className="h-4 w-4" />
                  </Button>
                </DialogPrimitive.Close>
              </header>

              <Tabs
                value={activeTab}
                onValueChange={(v) => onTabChange(v as SettingsTab)}
                className="flex min-h-0 min-w-0 flex-1 flex-col bg-bg-modal">
                <div className="h-12 shrink-0 border-b border-border-default px-4 md:px-6">
                  <TabsList
                    aria-label={tModal("modalNavLabel")}
                    className="h-12 w-full min-w-0 justify-start gap-0 overflow-x-auto overflow-y-hidden bg-transparent p-0 scrollbar-none [&::-webkit-scrollbar]:hidden">
                    {TAB_META.map(({ id, icon: Icon }) => (
                      <TabsTrigger
                        key={id}
                        value={id}
                        className={cn(
                          "h-12 min-h-12 shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-4 text-sm font-medium text-text-muted shadow-none transition-colors md:px-5",
                          "hover:text-text-primary",
                          "focus-visible:ring-0 focus-visible:ring-offset-0",
                          "data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:text-accent data-[state=active]:shadow-none",
                        )}>
                        <Icon className="mr-2 h-4 w-4 shrink-0" aria-hidden />
                        {tabLabel(id)}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                <TabsContent
                  value={activeTab}
                  className={cn(
                    "m-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                  )}>
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-4 py-4 touch-scroll md:p-6">
                    <SettingsPanels
                      locale={locale}
                      initial={initial}
                      loadError={loadError}
                      variant="modal"
                      activeTab={activeTab}
                      onTabChange={onTabChange}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </motion.div>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
