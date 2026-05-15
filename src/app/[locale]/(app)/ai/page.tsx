import { getTranslations } from "next-intl/server";

import { AiHistoryPageClient } from "@/features/finance/ai/AiHistoryPageClient";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Finance.ai" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default function AiPage() {
  return <AiHistoryPageClient />;
}
