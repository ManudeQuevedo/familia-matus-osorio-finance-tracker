import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { IncomesLoading } from "@/components/finance/FinancePageLoading";
import { IncomesPageClient } from "@/features/finance/incomes/IncomesPageClient";
import { fetchIncomesSnapshot } from "@/lib/finance/incomes-queries";
import { getFinanceServerSession } from "@/lib/finance/server-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "Finance.incomesMeta",
  });
  return { title: t("title"), description: t("description") };
}

export default function IncomesPage({ params }: Props) {
  return (
    <Suspense fallback={<IncomesLoading />}>
      <IncomesPageContent params={params} />
    </Suspense>
  );
}

async function IncomesPageContent({ params }: Props) {
  const { locale } = await params;
  const { supabase, user } = await getFinanceServerSession();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data, error } = await fetchIncomesSnapshot(supabase, {
    userId: user.id,
    year,
    month,
    locale: locale === "es" ? "es" : "en",
  });

  return (
    <IncomesPageClient
      locale={locale}
      year={year}
      month={month}
      initialData={data}
      loadError={error}
      currentUserId={user.id}
    />
  );
}
