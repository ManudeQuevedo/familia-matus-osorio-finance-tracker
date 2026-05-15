import type { LucideIcon } from "lucide-react";
import {
  Bike,
  Car,
  Circle,
  Gift,
  GraduationCap,
  Heart,
  Home,
  Laptop,
  Palmtree,
  PiggyBank,
  Plane,
  Target,
  Wallet,
} from "lucide-react";

export const GOAL_ICON_OPTIONS = [
  "target",
  "home",
  "car",
  "plane",
  "palmtree",
  "graduation-cap",
  "piggy-bank",
  "wallet",
  "heart",
  "gift",
  "laptop",
  "bike",
] as const;

export type GoalIconKey = (typeof GOAL_ICON_OPTIONS)[number];

const MAP: Record<string, LucideIcon> = {
  target: Target,
  home: Home,
  car: Car,
  plane: Plane,
  palmtree: Palmtree,
  "graduation-cap": GraduationCap,
  "piggy-bank": PiggyBank,
  wallet: Wallet,
  heart: Heart,
  gift: Gift,
  laptop: Laptop,
  bike: Bike,
};

export function goalLucideIcon(icon: string): LucideIcon {
  return MAP[icon.trim().toLowerCase()] ?? Circle;
}

export const GOAL_COLOR_OPTIONS = [
  "#22c55e",
  "#0ea5e9",
  "#8b5cf6",
  "#f97316",
  "#ec4899",
  "#eab308",
  "#14b8a6",
  "#ef4444",
] as const;
