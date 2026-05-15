import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { DebtsLoading } from "@/components/finance/FinancePageLoading";
import { DebtsPageClient } from "@/features/finance/debts/DebtsPageClient";
import { fetchDebtsSnapshot } from "@/lib/finance/debts-queries";
import { getFinanceServerSession } from "@/lib/finance/server-session";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "Finance.debtsMeta",
  });
  return { title: t("title"), description: t("description") };
}

export default function DebtsPage({ params }: Props) {
  return (
    <Suspense fallback={<DebtsLoading />}>
      <DebtsPageContent params={params} />
    </Suspense>
  );
}

async function DebtsPageContent({ params }: Props) {
  const { locale } = await params;
  const { supabase, user } = await getFinanceServerSession();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data, error } = await fetchDebtsSnapshot(supabase, {
    userId: user.id,
    year,
    month,
    locale: locale === "es" ? "es" : "en",
  });

  return (
    <DebtsPageClient
      locale={locale}
      year={year}
      month={month}
      initialData={data}
      loadError={error}
    />
  );
}
