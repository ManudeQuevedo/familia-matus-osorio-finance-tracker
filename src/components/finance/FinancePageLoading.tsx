import { FinancePageShell } from "@/components/finance/FinancePageShell";
import { Skeleton } from "@/components/ui/skeleton";

function PageHeaderSkeleton({
  withSubtitle = true,
  withActions = false,
}: {
  withSubtitle?: boolean;
  withActions?: boolean;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <Skeleton className="h-8 w-48 sm:w-64" />
        {withSubtitle ? <Skeleton className="mt-2 h-4 w-56" /> : null}
      </div>
      {withActions ? (
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      ) : null}
    </div>
  );
}

function MetricCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className={
        count === 3
          ? "grid gap-3 sm:grid-cols-3"
          : "grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      }>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

function TabBarSkeleton() {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-24 shrink-0 rounded-full" />
      ))}
    </div>
  );
}

export function DashboardLoading() {
  return (
    <FinancePageShell className="space-y-6">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </div>
      <MetricCardsSkeleton />
      <Skeleton className="h-48 rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </FinancePageShell>
  );
}

export function ExpensesLoading() {
  return (
    <FinancePageShell className="space-y-6">
      <PageHeaderSkeleton withActions />
      <TabBarSkeleton />
      <Skeleton className="h-12 w-full rounded-lg" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </FinancePageShell>
  );
}

export function IncomesLoading() {
  return (
    <FinancePageShell className="space-y-6">
      <PageHeaderSkeleton withActions />
      <MetricCardsSkeleton count={3} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
    </FinancePageShell>
  );
}

export function GoalsLoading() {
  return (
    <FinancePageShell className="space-y-6">
      <PageHeaderSkeleton withActions />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-52 rounded-xl" />
        ))}
      </div>
    </FinancePageShell>
  );
}

export function DebtsLoading() {
  return (
    <FinancePageShell className="space-y-6">
      <PageHeaderSkeleton withActions />
      <MetricCardsSkeleton count={3} />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    </FinancePageShell>
  );
}

export function ReportsLoading() {
  return (
    <FinancePageShell className="space-y-6">
      <PageHeaderSkeleton withSubtitle={false} />
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 w-36 rounded-md" />
        <Skeleton className="h-10 w-32 rounded-md" />
        <Skeleton className="h-10 w-24 rounded-md" />
      </div>
      <MetricCardsSkeleton count={3} />
      <Skeleton className="h-72 rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </FinancePageShell>
  );
}

export function NotesLoading() {
  return (
    <FinancePageShell className="space-y-6">
      <PageHeaderSkeleton withActions />
      <TabBarSkeleton />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    </FinancePageShell>
  );
}

export function SettingsLoading() {
  return (
    <FinancePageShell className="space-y-8 pb-8 md:pb-10">
      <PageHeaderSkeleton />
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    </FinancePageShell>
  );
}
