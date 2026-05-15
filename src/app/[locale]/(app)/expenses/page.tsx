import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ExpensesLoading } from "@/components/finance/FinancePageLoading";
import { ExpensesPageClient } from "@/features/finance/expenses/ExpensesPageClient";
import { fetchExpensesSnapshot } from "@/lib/finance/expenses-queries";
import { getFinanceServerSession } from "@/lib/finance/server-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "Finance.expensesMeta",
  });
  return { title: t("title"), description: t("description") };
}

export default function ExpensesPage({ params }: Props) {
  return (
    <Suspense fallback={<ExpensesLoading />}>
      <ExpensesPageContent params={params} />
    </Suspense>
  );
}

async function ExpensesPageContent({ params }: Props) {
  const { locale } = await params;
  const { supabase, user } = await getFinanceServerSession();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data, error } = await fetchExpensesSnapshot(supabase, {
    userId: user.id,
    year,
    month,
    locale: locale === "es" ? "es" : "en",
  });

  return (
    <ExpensesPageClient
      locale={locale}
      year={year}
      month={month}
      initialData={data}
      loadError={error}
    />
  );
}
