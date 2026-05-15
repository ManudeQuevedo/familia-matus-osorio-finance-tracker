import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { NotesLoading } from "@/components/finance/FinancePageLoading";
import { NotesPageClient } from "@/features/finance/notes/NotesPageClient";
import { fetchNotesSnapshot } from "@/lib/finance/notes-queries";
import { getFinanceServerSession } from "@/lib/finance/server-session";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "Finance.notesMeta",
  });
  return { title: t("title"), description: t("description") };
}

export default function NotesPage({ params }: Props) {
  return (
    <Suspense fallback={<NotesLoading />}>
      <NotesPageContent params={params} />
    </Suspense>
  );
}

async function NotesPageContent({ params }: Props) {
  const { locale } = await params;
  const { supabase, user } = await getFinanceServerSession();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  const { data, error } = await fetchNotesSnapshot(supabase, user.id);

  return (
    <NotesPageClient locale={locale} initialData={data} loadError={error} />
  );
}
