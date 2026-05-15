import { FinancePageShell } from "@/components/finance/FinancePageShell";
import { Skeleton } from "@/components/ui/skeleton";

export default function AiLoading() {
  return (
    <FinancePageShell className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    </FinancePageShell>
  );
}
