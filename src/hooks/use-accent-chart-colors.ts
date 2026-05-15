"use client";

import { useMemo } from "react";

import { useUserPreferences } from "@/components/providers/UserPreferencesProvider";
import { getAccentChartColors } from "@/lib/finance/accent";

export function useAccentChartColors() {
  const { accentColor } = useUserPreferences();
  return useMemo(() => getAccentChartColors(accentColor), [accentColor]);
}
