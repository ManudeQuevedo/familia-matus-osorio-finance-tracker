"use client";

import { motion } from "framer-motion";
import { usePathname } from "@/i18n/navigation";

/** Enter-only transition — no AnimatePresence wait so navigation feels instant. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="flex min-h-0 flex-1 flex-col">
      {children}
    </motion.div>
  );
}
