import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  Car,
  Circle,
  Coffee,
  FerrisWheel,
  Film,
  Gamepad2,
  HeartPulse,
  PawPrint,
  RefreshCw,
  Scale,
  ShoppingBag,
  Target,
  Utensils,
  Users,
  Wrench,
  Zap,
} from "lucide-react";

/** Maps stored icon names (often kebab-case) to Lucide components for expense classifications. */
const MAP: Record<string, LucideIcon> = {
  "heart-pulse": HeartPulse,
  car: Car,
  wrench: Wrench,
  users: Users,
  "paw-print": PawPrint,
  pawprint: PawPrint,
  scale: Scale,
  utensils: Utensils,
  "ferris-wheel": FerrisWheel,
  film: Film,
  "shopping-bag": ShoppingBag,
  "gamepad-2": Gamepad2,
  gamepad2: Gamepad2,
  coffee: Coffee,
};

export function expenseClassificationLucide(icon: string | null | undefined): LucideIcon {
  if (!icon) return Circle;
  const key = icon.trim().toLowerCase();
  return MAP[key] ?? Circle;
}

export const expenseModalTypeIcons = {
  recurring: RefreshCw,
  planned: Calendar,
  unplanned: Target,
  unexpected: Zap,
} satisfies Record<string, LucideIcon>;
