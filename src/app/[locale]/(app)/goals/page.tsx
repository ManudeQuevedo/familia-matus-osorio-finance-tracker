import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { GoalsLoading } from "@/components/finance/FinancePageLoading";
import { GoalsPageClient } from "@/features/finance/goals/GoalsPageClient";
import { fetchGoalsSnapshot } from "@/lib/finance/goals-queries";
import { getFinanceServerSession } from "@/lib/finance/server-session";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "Finance.goalsMeta",
  });
  return { title: t("title"), description: t("description") };
}

export default function GoalsPage({ params }: Props) {
  return (
    <Suspense fallback={<GoalsLoading />}>
      <GoalsPageContent params={params} />
    </Suspense>
  );
}

async function GoalsPageContent({ params }: Props) {
  const { locale } = await params;
  const { supabase, user } = await getFinanceServerSession();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data, error } = await fetchGoalsSnapshot(supabase, {
    userId: user.id,
    year,
    month,
    locale: locale === "es" ? "es" : "en",
  });

  return (
    <GoalsPageClient
      locale={locale}
      year={year}
      month={month}
      initialData={data}
      loadError={error}
    />
  );
}
