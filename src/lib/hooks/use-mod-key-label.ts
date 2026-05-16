"use client";

import { useEffect, useState } from "react";

export function useModKeyLabel() {
  const [label, setLabel] = useState("⌘");

  useEffect(() => {
    const tick = () => {
      setLabel(navigator.platform.toLowerCase().includes("mac") ? "⌘" : "Ctrl");
    };
    tick();
    return () => {};
  }, []);

  return label;
}
