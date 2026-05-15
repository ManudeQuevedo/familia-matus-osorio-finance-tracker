import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Bug,
  Car,
  Circle,
  CreditCard,
  Dumbbell,
  GraduationCap,
  Home,
  Landmark,
  TrendingUp,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  home: Home,
  "graduation-cap": GraduationCap,
  car: Car,
  dumbbell: Dumbbell,
  "credit-card": CreditCard,
  landmark: Landmark,
  "trending-up": TrendingUp,
  ant: Bug,
  "alert-circle": AlertCircle,
};

export function categoryLucideIcon(icon: string): LucideIcon {
  const key = icon.trim().toLowerCase();
  return MAP[key] ?? Circle;
}
