"use client";

import { FinanceHeaderUserMenu } from "@/components/finance/FinanceHeaderUserMenu";
import { useFinanceShellUser } from "@/contexts/finance-shell-user-context";

/** Account menu in page headers (desktop). On mobile, use `FinanceMobileTopBar` in the shell. */
export function FinanceContentHeaderActions() {
  const user = useFinanceShellUser();
  if (!user) return null;
  return (
    <div className="hidden shrink-0 items-center gap-2 md:flex">
      <FinanceHeaderUserMenu
        email={user.email}
        fullName={user.fullName}
        avatarUrl={user.avatarUrl}
      />
    </div>
  );
}
