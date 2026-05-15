"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

type StackEntry = { id: string; handler: () => void };

export type ModalEscapeStackContextValue = {
  register: (id: string, handler: () => void) => () => void;
};

export const ModalEscapeStackContext =
  createContext<ModalEscapeStackContextValue | null>(null);

/** LIFO Escape handling: only the most recently registered layer closes on ESC. */
export function ModalEscapeStackProvider({
  children,
}: {
  children: ReactNode;
}) {
  const stackRef = useRef<StackEntry[]>([]);

  const register = useCallback((id: string, handler: () => void) => {
    stackRef.current = stackRef.current.filter((e) => e.id !== id);
    stackRef.current.push({ id, handler });
    return () => {
      stackRef.current = stackRef.current.filter((e) => e.id !== id);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;

      // Let nested Radix Select / listbox handle Escape first.
      const active = document.activeElement;
      if (active instanceof HTMLElement) {
        if (active.closest('[role="listbox"]')) return;
        if (active.getAttribute("role") === "option") return;
      }

      const top = stackRef.current[stackRef.current.length - 1];
      if (!top) return;

      e.preventDefault();
      e.stopPropagation();
      top.handler();
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return (
    <ModalEscapeStackContext.Provider value={{ register }}>
      {children}
    </ModalEscapeStackContext.Provider>
  );
}
