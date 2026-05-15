import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ReportsLoading } from "@/components/finance/FinancePageLoading";
import { ReportsPageClient } from "@/features/finance/reports/ReportsPageClient";
import { fetchReportsSnapshot } from "@/lib/finance/reports-queries";
import { getFinanceServerSession } from "@/lib/finance/server-session";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "Finance.reportsMeta",
  });
  return { title: t("title"), description: t("description") };
}

export default function ReportsPage({ params }: Props) {
  return (
    <Suspense fallback={<ReportsLoading />}>
      <ReportsPageContent params={params} />
    </Suspense>
  );
}

async function ReportsPageContent({ params }: Props) {
  const { locale } = await params;
  const { supabase, user } = await getFinanceServerSession();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data, error } = await fetchReportsSnapshot(supabase, {
    periodType: "monthly",
    year,
    month,
    locale: locale === "es" ? "es" : "en",
  });

  return (
    <ReportsPageClient
      year={year}
      month={month}
      initialData={data}
      loadError={error}
    />
  );
}
