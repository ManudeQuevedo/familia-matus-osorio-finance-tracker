import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { NotesLoading } from "@/components/finance/FinancePageLoading";
import { NoteEditorPageClient } from "@/features/finance/notes/NoteEditorPageClient";
import { fetchNoteById } from "@/lib/finance/notes-queries";
import { getFinanceServerSession } from "@/lib/finance/server-session";

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, id } = await params;
  const t = await getTranslations({
    locale,
    namespace: "Finance.notesMeta",
  });
  return { title: `${t("title")} · ${id.slice(0, 8)}` };
}

export default function NoteEditorPage({ params }: Props) {
  return (
    <Suspense fallback={<NotesLoading />}>
      <NoteEditorPageContent params={params} />
    </Suspense>
  );
}

async function NoteEditorPageContent({ params }: Props) {
  const { locale, id } = await params;
  const { supabase, user } = await getFinanceServerSession();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  const { data: note, error } = await fetchNoteById(supabase, user.id, id);
  if (error === "not_found" || !note) {
    notFound();
  }
  if (error) {
    redirect(`/${locale}/notes`);
  }

  return <NoteEditorPageClient locale={locale} note={note} userId={user.id} />;
}
