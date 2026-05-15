"use client";

import { motion } from "framer-motion";

export function GoalProgressBar({
  percent,
  color,
}: {
  percent: number;
  color: string;
}) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-bg-card-hover bg-bg-card-hover">
      <motion.div
        className="h-full rounded-full bg-primary"
        style={color ? { backgroundColor: color } : undefined}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, percent)}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
      />
    </div>
  );
}
