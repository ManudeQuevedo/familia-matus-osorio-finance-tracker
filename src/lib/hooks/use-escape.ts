"use client";

import { useContext, useEffect, useId, useRef } from "react";

import { ModalEscapeStackContext } from "@/contexts/modal-escape-stack-context";

/**
 * Registers an Escape handler on the global LIFO modal stack (most recent wins).
 * When no provider is mounted, this is a no-op.
 */
export function useEscape(onEscape: () => void, enabled = true) {
  const ctx = useContext(ModalEscapeStackContext);
  const id = useId();
  const onEscapeRef = useRef(onEscape);

  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!ctx || !enabled) return;
    return ctx.register(id, () => onEscapeRef.current());
  }, [ctx, id, enabled]);
}
