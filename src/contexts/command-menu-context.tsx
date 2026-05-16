"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type CommandMenuContextValue = {
  open: boolean;
  openCommandMenu: () => void;
  closeCommandMenu: () => void;
  setOpen: (v: boolean) => void;
};

const CommandMenuContext = createContext<CommandMenuContextValue | null>(null);

export function CommandMenuProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openCommandMenu = useCallback(() => setOpen(true), []);
  const closeCommandMenu = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({
      open,
      openCommandMenu,
      closeCommandMenu,
      setOpen,
    }),
    [open, openCommandMenu, closeCommandMenu],
  );

  return (
    <CommandMenuContext.Provider value={value}>
      {children}
    </CommandMenuContext.Provider>
  );
}

export function useCommandMenu() {
  const ctx = useContext(CommandMenuContext);
  if (!ctx) {
    throw new Error("useCommandMenu must be used within CommandMenuProvider");
  }
  return ctx;
}
