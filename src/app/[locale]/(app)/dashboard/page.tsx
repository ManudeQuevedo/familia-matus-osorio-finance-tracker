import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { DashboardLoading } from "@/components/finance/FinancePageLoading";
import { DashboardHome } from "@/features/finance/dashboard/DashboardHome";
import { fetchDashboardSnapshot } from "@/lib/finance/dashboard-queries";
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

export default function DashboardPage({ params }: Props) {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardPageContent params={params} />
    </Suspense>
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
  const { data, error } = await fetchDashboardSnapshot(supabase, {
    userId: user.id,
    year,
    month,
    locale: locale === "es" ? "es" : "en",
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
