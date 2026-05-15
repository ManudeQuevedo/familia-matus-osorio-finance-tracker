import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SettingsLoading } from "@/components/finance/FinancePageLoading";
import { SettingsPageClient } from "@/features/finance/settings/SettingsPageClient";
import { fetchSettingsSnapshot } from "@/lib/finance/settings-queries";
import { getFinanceServerSession } from "@/lib/finance/server-session";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Finance.settings" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default function SettingsPage({ params }: Props) {
  return (
    <Suspense fallback={<SettingsLoading />}>
      <SettingsPageContent params={params} />
    </Suspense>
  );
}

async function SettingsPageContent({ params }: Props) {
  const { locale } = await params;
  const { supabase, user } = await getFinanceServerSession();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const { data, error } = await fetchSettingsSnapshot(
    supabase,
    user.id,
    locale === "es" ? "es" : "en",
  );

  return (
    <SettingsPageClient locale={locale} initial={data} loadError={error} />
  );
}
