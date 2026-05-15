import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Building2,
  Coins,
  Gem,
  Heart,
  Home,
  Landmark,
  PiggyBank,
  Shield,
  Sparkles,
  Star,
  TrendingUp,
  Trees,
  Umbrella,
  Wallet,
  Zap,
} from "lucide-react";

export { SIDEBAR_ICON_STORAGE_BASE as SIDEBAR_ICON_STORAGE_KEY } from "@/lib/storage/user-preferences-storage";

export const SIDEBAR_ICON_OPTIONS = [
  { id: "home", Icon: Home },
  { id: "piggy-bank", Icon: PiggyBank },
  { id: "wallet", Icon: Wallet },
  { id: "trending-up", Icon: TrendingUp },
  { id: "heart", Icon: Heart },
  { id: "star", Icon: Star },
  { id: "coins", Icon: Coins },
  { id: "banknote", Icon: Banknote },
  { id: "landmark", Icon: Landmark },
  { id: "building", Icon: Building2 },
  { id: "sparkles", Icon: Sparkles },
  { id: "gem", Icon: Gem },
  { id: "shield", Icon: Shield },
  { id: "umbrella", Icon: Umbrella },
  { id: "trees", Icon: Trees },
  { id: "zap", Icon: Zap },
] as const;

export type SidebarIconId = (typeof SIDEBAR_ICON_OPTIONS)[number]["id"];

const iconById = new Map(
  SIDEBAR_ICON_OPTIONS.map((o) => [o.id, o.Icon] as const),
);

export function getSidebarIcon(id: string | null | undefined): LucideIcon {
  if (id && iconById.has(id as SidebarIconId)) {
    return iconById.get(id as SidebarIconId)!;
  }
  return Home;
}

export function isSidebarIconId(value: string): value is SidebarIconId {
  return iconById.has(value as SidebarIconId);
}
