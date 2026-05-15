import {
  AlertCircle,
  BarChart3,
  BrainCircuit,
  CreditCard,
  Home,
  Menu,
  StickyNote,
  Target,
  TrendingUp,
} from "lucide-react";

import type { FinanceNavKey } from "@/components/finance/finance-nav-config";
import { cn } from "@/lib/utils";

export function FinanceNavIcon({
  name,
  className,
}: {
  name: FinanceNavKey;
  className?: string;
}) {
  const cls = cn("h-5 w-5 shrink-0", className);
  switch (name) {
    case "dashboard":
      return <Home className={cls} />;
    case "expenses":
      return <CreditCard className={cls} />;
    case "incomes":
      return <TrendingUp className={cls} />;
    case "goals":
      return <Target className={cls} />;
    case "debts":
      return <AlertCircle className={cls} />;
    case "reports":
      return <BarChart3 className={cls} />;
    case "ai":
      return <BrainCircuit className={cls} />;
    case "notes":
      return <StickyNote className={cls} />;
    case "more":
      return <Menu className={cls} />;
    default:
      return <Home className={cls} />;
  }
}
