"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const FAMILY_FINANCE_TABLES = [
  "expense_records",
  "recurring_expenses",
  "variable_expenses",
  "incomes",
  "goals",
  "goal_contributions",
  "debts",
  "debt_payments",
  "accounts",
  "notes",
] as const;

/**
 * Keeps Server Components aligned when another household member edits data.
 * Enable Realtime for these tables in Supabase Dashboard (Replication).
 */
export function RealtimeSync({ familyId }: { familyId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let channel = supabase.channel(`family-${familyId}`);

    for (const table of FAMILY_FINANCE_TABLES) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `family_id=eq.${familyId}`,
        },
        () => router.refresh(),
      );
    }

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [familyId, router]);

  return null;
}
