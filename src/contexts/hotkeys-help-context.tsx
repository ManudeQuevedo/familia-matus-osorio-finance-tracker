"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type HotkeysHelpContextValue = {
  open: boolean;
  openHotkeysHelp: () => void;
  closeHotkeysHelp: () => void;
};

const HotkeysHelpContext = createContext<HotkeysHelpContextValue | null>(null);

export function HotkeysHelpProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openHotkeysHelp = useCallback(() => setOpen(true), []);
  const closeHotkeysHelp = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({
      open,
      openHotkeysHelp,
      closeHotkeysHelp,
    }),
    [open, openHotkeysHelp, closeHotkeysHelp],
  );

  return (
    <HotkeysHelpContext.Provider value={value}>
      {children}
    </HotkeysHelpContext.Provider>
  );
}

export function useHotkeysHelp() {
  const ctx = useContext(HotkeysHelpContext);
  if (!ctx) {
    throw new Error("useHotkeysHelp must be used within HotkeysHelpProvider");
  }
  return ctx;
}
