"use client";

import { motion } from "framer-motion";

const easeOut = [0, 0, 0.2, 1] as const;

export function LoginBranding({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <motion.div
      className="mb-8 max-w-lg text-center text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: easeOut }}>
      <motion.p
        className="text-xs font-medium uppercase tracking-[0.28em] text-amber-200/90"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: easeOut }}>
        {eyebrow}
      </motion.p>
      <motion.h1
        className="mt-3 text-3xl font-bold tracking-tight"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: easeOut }}>
        {title}
      </motion.h1>
      <motion.p
        className="mt-3 text-sm text-white/70"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: easeOut }}>
        {subtitle}
      </motion.p>
    </motion.div>
  );
}
