"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

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
import { cn } from "@/lib/utils";

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

  useEscape(onClose, true);

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
            className="fixed inset-0 bg-[rgba(0,0,0,0.6)] backdrop-blur-sm"
          />
          <DialogPrimitive.Content
            forceMount
            asChild
            onCloseAutoFocus={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{
                opacity: 0,
                scale: 0.95,
                transition: { duration: 0.2, ease: "easeOut" },
              }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className={cn(
                "fixed left-1/2 top-1/2 z-101 flex max-h-[700px] w-[80vw] max-w-[1000px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden bg-bg-card shadow-2xl outline-none touch-scroll",
                "h-dvh max-h-none w-full max-w-none rounded-none",
                "md:h-[80vh] md:max-h-[700px] md:w-[80vw] md:max-w-[1000px] md:rounded-[16px]",
              )}>
              <header className="relative flex h-[52px] shrink-0 items-center justify-center border-b border-border-subtle bg-bg-card px-3">
                <DialogPrimitive.Title className="text-sm font-semibold text-text-primary">
                  {tModal("modalTitle")}
                </DialogPrimitive.Title>
                <DialogPrimitive.Close asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={tModal("close")}
                    className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full">
                    <X className="h-4 w-4" />
                  </Button>
                </DialogPrimitive.Close>
              </header>

              <Tabs
                value={activeTab}
                onValueChange={(v) => onTabChange(v as SettingsTab)}
                className="flex min-h-0 min-w-0 flex-1 flex-col bg-bg-card">
                <div className="shrink-0 border-b border-border-default px-6">
                  <TabsList
                    aria-label={tModal("modalNavLabel")}
                    className="h-12 w-full min-w-0 justify-start gap-0 overflow-x-auto bg-transparent p-0 scrollbar-none [&::-webkit-scrollbar]:hidden">
                    {TAB_META.map(({ id, icon: Icon }) => (
                      <TabsTrigger
                        key={id}
                        value={id}
                        className={cn(
                          "h-12 shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-5 text-sm font-medium text-text-muted shadow-none transition-colors",
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
                    "m-0 flex min-h-0 min-w-0 flex-1 flex-col outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                    "max-md:max-h-[min(100dvh-7rem,100%)] max-md:overflow-y-auto max-md:overflow-x-hidden max-md:touch-scroll md:overflow-hidden",
                  )}>
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col p-6">
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
