"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

export type HotkeyHandler = (e: KeyboardEvent) => void;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  if (target.getAttribute("role") === "textbox") return true;
  return false;
}

function keyMatches(e: KeyboardEvent, key: string): boolean {
  const want = key.toLowerCase();
  const got = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
  if (want === "?") return e.key === "?";
  if (want === "/") return e.key === "/";
  return got === want;
}

export type UseHotkeyOptions = {
  meta?: boolean;
  shift?: boolean;
};

/** Desktop (≥768px) hotkeys. Skips firing when typing in inputs except Escape. */
export function useHotkey(
  key: string,
  handler: HotkeyHandler,
  options?: UseHotkeyOptions,
) {
  const handlerRef = useRef(handler);

  const metaWanted = options?.meta === true;
  const shiftWanted = options?.shift === true;

  useLayoutEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (window.innerWidth < 768) return;

      const target = e.target;
      const typing = isTypingTarget(target);
      const alwaysAllow = e.key === "Escape";
      if (typing && !alwaysAllow) return;

      const metaOk = metaWanted ? e.metaKey || e.ctrlKey : true;
      if (!metaOk) return;

      const shiftOk = shiftWanted ? e.shiftKey : !e.shiftKey;
      if (!shiftOk) return;

      const extraMods =
        (!metaWanted && (e.metaKey || e.ctrlKey)) ||
        (!shiftWanted && e.altKey);

      if (extraMods && key.toLowerCase() !== "escape") return;

      if (!keyMatches(e, key)) return;

      e.preventDefault();
      handlerRef.current(e);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [key, metaWanted, shiftWanted]);
}
