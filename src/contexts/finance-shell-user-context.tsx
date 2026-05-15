"use client";

import { createContext, useContext, type ReactNode } from "react";

export type FinanceShellUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
};

const FinanceShellUserContext = createContext<FinanceShellUser | null>(null);

export function FinanceShellUserProvider({
  user,
  children,
}: {
  user: FinanceShellUser;
  children: ReactNode;
}) {
  return (
    <FinanceShellUserContext.Provider value={user}>
      {children}
    </FinanceShellUserContext.Provider>
  );
}

export function useFinanceShellUser() {
  return useContext(FinanceShellUserContext);
}
