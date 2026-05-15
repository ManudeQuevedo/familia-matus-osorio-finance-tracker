"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type SettingsTab = "perfil" | "seguridad" | "preferencias" | "datos";

type SettingsModalContextValue = {
  isOpen: boolean;
  activeTab: SettingsTab;
  setActiveTab: (tab: SettingsTab) => void;
  openSettings: (tab?: SettingsTab) => void;
  closeSettings: () => void;
};

const SettingsModalContext = createContext<SettingsModalContextValue | null>(
  null,
);

const DEFAULT_TAB: SettingsTab = "perfil";

export function SettingsModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>(DEFAULT_TAB);

  const setActiveTabCb = useCallback((tab: SettingsTab) => {
    setActiveTab(tab);
  }, []);

  const openSettings = useCallback((tab?: SettingsTab) => {
    if (tab) setActiveTab(tab);
    setIsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setIsOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      activeTab,
      setActiveTab: setActiveTabCb,
      openSettings,
      closeSettings,
    }),
    [isOpen, activeTab, setActiveTabCb, openSettings, closeSettings],
  );

  return (
    <SettingsModalContext.Provider value={value}>
      {children}
    </SettingsModalContext.Provider>
  );
}

export function useSettingsModal() {
  const ctx = useContext(SettingsModalContext);
  if (!ctx) {
    throw new Error(
      "useSettingsModal must be used within SettingsModalProvider",
    );
  }
  return ctx;
}
