import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { MonthlyComparisonChart } from "@/components/dashboard/monthly-comparison-chart";
import { DashboardLoading } from "@/components/finance/FinancePageLoading";
import { DashboardHome } from "@/features/finance/dashboard/DashboardHome";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchDashboardSnapshot } from "@/lib/finance/dashboard-queries";
import { fetchMonthlyComparisonData } from "@/lib/finance/monthly-comparison-queries";
import { getFinanceServerSession } from "@/lib/finance/server-session";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "Finance.dashboardMeta",
  });
  return {
    title: t("title"),
    description: t("description"),
  };
}

function MonthlyComparisonSkeleton() {
  return (
    <div className="w-full min-w-0 px-4 pb-8 md:px-8">
      <section className="mt-6">
        <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="space-y-2">
            <Skeleton className="h-7 w-52" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-9 w-48" />
          </div>
        </div>
        <div
          className="rounded-xl border border-border-default p-6 dark:border-border-default"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--border-default)",
          }}>
          <Skeleton className="h-60 w-full md:h-80" />
        </div>
      </section>
    </div>
  );
}

export default function DashboardPage({ params }: Props) {
  return (
    <>
      <Suspense fallback={<DashboardLoading />}>
        <DashboardPageContent params={params} />
      </Suspense>
      <Suspense fallback={<MonthlyComparisonSkeleton />}>
        <DashboardMonthlyComparison params={params} />
      </Suspense>
    </>
  );
}

async function DashboardPageContent({ params }: Props) {
  const { locale } = await params;
  const { supabase, user } = await getFinanceServerSession();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const appLocale = locale === "es" ? "es" : "en";

  const { data, error } = await fetchDashboardSnapshot(supabase, {
    userId: user.id,
    year,
    month,
    locale: appLocale,
  });

  return (
    <DashboardHome
      locale={locale}
      year={year}
      month={month}
      initialData={data}
      loadError={error}
      userEmail={user.email ?? undefined}
    />
  );
}

async function DashboardMonthlyComparison({ params }: Props) {
  const { locale } = await params;
  const { supabase, user } = await getFinanceServerSession();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  const appLocale = locale === "es" ? "es" : "en";
  const { data, error } = await fetchMonthlyComparisonData(supabase, {
    userId: user.id,
    locale: appLocale,
  });

  return (
    <div className="w-full min-w-0 px-4 pb-8 md:px-8">
      <MonthlyComparisonChart data={data} loadError={error} />
    </div>
  );
}
