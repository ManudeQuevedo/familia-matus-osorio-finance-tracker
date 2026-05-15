import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "Finance.placeholders",
  });
  return { title: t("moreTitle") };
}

export default async function MorePage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "Finance.placeholders",
  });
  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">{t("moreTitle")}</h1>
        <p className="mt-2 text-sm text-text-secondary dark:text-text-muted">
          {t("moreIntro")}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <Button asChild variant="outline" className="justify-start">
          <Link href="/debts">{t("linkDebts")}</Link>
        </Button>
        <Button asChild variant="outline" className="justify-start">
          <Link href="/reports">{t("linkReports")}</Link>
        </Button>
        <Button asChild variant="outline" className="justify-start">
          <Link href="/ai">{t("linkAi")}</Link>
        </Button>
        <Button asChild variant="outline" className="justify-start">
          <Link href="/notes">{t("linkNotes")}</Link>
        </Button>
        <Button asChild variant="outline" className="justify-start">
          <Link href="/settings">{t("linkSettings")}</Link>
        </Button>
      </div>
    </div>
  );
}
