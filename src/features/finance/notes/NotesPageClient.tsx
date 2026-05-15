"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, Pin, Plus, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";

import { FinancePageShell } from "@/components/finance/FinancePageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "@/i18n/navigation";
import { extractPlainText } from "@/lib/finance/note-content";
import { noteCardClass } from "@/lib/finance/note-colors";
import { createEmptyNote } from "@/lib/finance/notes-actions";
import { formatShortDate } from "@/lib/finance/format";
import {
  getReminderStatus,
  type NoteRow,
  type NotesSnapshot,
} from "@/lib/finance/notes-queries";
import { cn } from "@/lib/utils";

type NoteFilter = "all" | "reminders" | "todos" | "pinned";

function sortNotes(notes: NoteRow[]): NoteRow[] {
  return [...notes].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

function filterNotes(notes: NoteRow[], filter: NoteFilter): NoteRow[] {
  switch (filter) {
    case "reminders":
      return notes.filter((n) => n.type === "reminder");
    case "todos":
      return notes.filter((n) => n.type === "todo" && !n.is_completed);
    case "pinned":
      return notes.filter((n) => n.is_pinned);
    default:
      return notes;
  }
}

function notePreview(note: NoteRow): string {
  const fromJson = extractPlainText(note.content_json);
  return fromJson || note.content;
}

function matchesSearch(note: NoteRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const title = (note.title ?? "").toLowerCase();
  const body = notePreview(note).toLowerCase();
  return title.includes(q) || body.includes(q);
}

function NoteCard({
  note,
  locale,
  onOpen,
  t,
}: {
  note: NoteRow;
  locale: string;
  onOpen: (note: NoteRow) => void;
  t: ReturnType<typeof useTranslations<"Finance.notes">>;
}) {
  const reminderStatus =
    note.type === "reminder" ? getReminderStatus(note.reminder_date) : "none";
  const preview = notePreview(note);

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onOpen(note)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(note);
        }
      }}
      className={cn(
        "cursor-pointer overflow-hidden border transition-shadow hover:shadow-md",
        noteCardClass(note.color),
        reminderStatus === "overdue" &&
          "border-red-300/80 dark:border-red-800/80",
        reminderStatus === "today" && "border-accent/60",
      )}>
      <CardContent className="flex h-full min-h-[140px] flex-col p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            {note.is_pinned ? (
              <Pin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            ) : null}
            {note.type === "todo" && note.is_completed ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            ) : null}
            <div className="min-w-0 flex-1">
              {note.title ? (
                <p
                  className={cn(
                    "font-semibold leading-snug",
                    note.type === "todo" &&
                      note.is_completed &&
                      "text-text-muted line-through",
                  )}>
                  {note.title}
                </p>
              ) : null}
              <p
                className={cn(
                  "line-clamp-3 text-sm text-text-secondary",
                  note.title && "mt-1",
                  note.type === "todo" &&
                    note.is_completed &&
                    "text-text-muted line-through",
                )}>
                {preview || t("emptyPreview")}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="shrink-0 text-xs">
            {t(`types.${note.type}`)}
          </Badge>
        </div>

        <p className="mt-auto pt-3 text-xs text-text-muted">
          {formatShortDate(locale, note.updated_at)}
        </p>
      </CardContent>
    </Card>
  );
}

export function NotesPageClient({
  locale,
  initialData,
  loadError,
}: {
  locale: string;
  initialData: NotesSnapshot | null;
  loadError: string | null;
  openNewOnMount?: boolean;
}) {
  const t = useTranslations("Finance.notes");
  const tc = useTranslations("Finance.common");
  const intlLocale = useLocale();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [filter, setFilter] = useState<NoteFilter>("all");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ["finance-notes"],
    queryFn: async () => {
      const res = await fetch("/api/finance/notes");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<NotesSnapshot>;
    },
    initialData: initialData ?? undefined,
  });

  const snapshot = data ?? initialData;
  const displayedNotes = useMemo(() => {
    if (!snapshot) return [];
    return sortNotes(filterNotes(snapshot.notes, filter)).filter((n) =>
      matchesSearch(n, search),
    );
  }, [snapshot, filter, search]);

  const openNote = useCallback(
    (note: NoteRow) => {
      router.push(`/notes/${note.id}`);
    },
    [router],
  );

  const handleNewNote = async () => {
    setCreating(true);
    setCreateError(null);
    const res = await createEmptyNote({ locale });
    setCreating(false);
    if (res.ok && res.note) {
      await queryClient.invalidateQueries({ queryKey: ["finance-notes"] });
      router.push(`/notes/${res.note.id}`);
      return;
    }
    setCreateError(res.ok ? t("createError") : (res.error ?? t("createError")));
  };

  const filters: { key: NoteFilter; label: string }[] = [
    { key: "all", label: t("filters.all") },
    { key: "reminders", label: t("filters.reminders") },
    { key: "todos", label: t("filters.todos") },
    { key: "pinned", label: t("filters.pinned") },
  ];

  if (loadError && !snapshot) {
    return (
      <FinancePageShell className="flex flex-col items-center justify-center py-10 text-center">
        <p className="text-sm text-red-600">{tc("error")}</p>
        <Button className="mt-4" onClick={() => refetch()}>
          {tc("retry")}
        </Button>
      </FinancePageShell>
    );
  }

  return (
    <FinancePageShell className="pb-24 md:pb-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6">
        <header className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {t("title")}
              </h1>
              <p className="mt-1 text-sm text-text-muted">{t("subtitle")}</p>
            </div>
            <Button
              size="sm"
              disabled={creating}
              onClick={() => void handleNewNote()}>
              <Plus className="mr-1 h-4 w-4" />
              {creating ? tc("saving") : t("add")}
            </Button>
          </div>

          {createError ? (
            <Alert variant="destructive">
              <AlertDescription>{createError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-9"
            />
          </div>
        </header>

        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition",
                filter === f.key
                  ? "bg-accent-muted text-accent"
                  : "bg-bg-card-hover text-text-secondary hover:bg-zinc-200 bg-bg-card-nested dark:text-text-muted",
              )}>
              {f.label}
            </button>
          ))}
        </div>

        {isFetching && !snapshot ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : null}

        {isError ? <p className="text-sm text-red-600">{tc("error")}</p> : null}

        {snapshot && displayedNotes.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-text-muted">
              {search.trim() ? t("searchEmpty") : t("empty")}
            </CardContent>
          </Card>
        ) : null}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {displayedNotes.map((note, i) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}>
              <NoteCard
                note={note}
                locale={intlLocale}
                onOpen={openNote}
                t={t}
              />
            </motion.div>
          ))}
        </div>
      </motion.div>
    </FinancePageShell>
  );
}
