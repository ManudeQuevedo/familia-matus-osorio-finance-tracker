"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

/**
 * Deferred client mount avoids SSR for cmdk bundle; runs once after hydration.
 */
const LazyCommandMenuInner = dynamic(
  () =>
    import("./command-menu-inner").then((m) => ({
      default: m.CommandMenuInner,
    })),
  { ssr: false },
);

export function CommandMenuBootstrap() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setHydrated(true));
  }, []);

  if (!hydrated) return null;

  return <LazyCommandMenuInner />;
}
