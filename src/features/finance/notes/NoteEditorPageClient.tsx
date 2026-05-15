"use client";

import type { JSONContent } from "@tiptap/react";
import { ArrowLeft, Palette, Pin, PinOff, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { FinancePageShell } from "@/components/finance/FinancePageShell";
import type { RichTextEditorChange } from "@/components/notes/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NOTE_COLOR_OPTIONS,
  noteColorDotClass,
  type NoteColor,
} from "@/lib/finance/note-colors";
import { EMPTY_TIPTAP_DOC } from "@/lib/finance/note-content";
import {
  deleteNote,
  saveNoteContent,
  toggleNotePinned,
  updateNoteMeta,
} from "@/lib/finance/notes-actions";
import type { NoteRow } from "@/lib/finance/notes-queries";
import type { NoteAttachmentMeta } from "@/lib/finance/note-storage";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const RichTextEditor = dynamic(
  () =>
    import("@/components/notes/rich-text-editor").then((m) => m.RichTextEditor),
  { ssr: false, loading: () => <EditorSkeleton /> },
);

function EditorSkeleton() {
  return (
    <div className="animate-pulse space-y-3 p-4">
      <div className="h-10 rounded bg-zinc-200 bg-bg-card-hover" />
      <div className="h-64 rounded bg-zinc-200 bg-bg-card-hover" />
    </div>
  );
}

type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export function NoteEditorPageClient({
  locale,
  note: initialNote,
  userId,
}: {
  locale: string;
  note: NoteRow;
  userId: string;
}) {
  const t = useTranslations("Finance.notes.editor");
  const tc = useTranslations("Finance.common");
  const router = useRouter();

  const [title, setTitle] = useState(initialNote.title ?? "");
  const [color, setColor] = useState(
    (NOTE_COLOR_OPTIONS.includes(initialNote.color as NoteColor)
      ? initialNote.color
      : "default") as NoteColor,
  );
  const [isPinned, setIsPinned] = useState(initialNote.is_pinned);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const pendingRef = useRef<RichTextEditorChange | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPayloadRef = useRef<RichTextEditorChange>({
    contentJson: initialNote.content_json ?? EMPTY_TIPTAP_DOC,
    plainText: initialNote.content,
    attachments: initialNote.attachments ?? [],
    sketchData: initialNote.sketch_data,
  });

  const flushSave = useCallback(async () => {
    const payload = pendingRef.current ?? latestPayloadRef.current;
    if (!payload) return;

    setSaveStatus("saving");
    const res = await saveNoteContent({
      locale,
      id: initialNote.id,
      title,
      content: payload.plainText,
      contentJson: payload.contentJson,
      attachments: payload.attachments,
      sketchData: payload.sketchData,
    });

    if (res.ok) {
      setSaveStatus("saved");
      pendingRef.current = null;
    } else {
      setSaveStatus("error");
    }
  }, [locale, initialNote.id, title]);

  const scheduleSave = useCallback(
    (payload: RichTextEditorChange) => {
      latestPayloadRef.current = payload;
      pendingRef.current = payload;
      setSaveStatus("pending");

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void flushSave();
      }, 2000);
    },
    [flushSave],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const onTitleBlur = () => {
    void updateNoteMeta({
      locale,
      id: initialNote.id,
      title,
      color,
    });
  };

  const onColorChange = async (c: NoteColor) => {
    setColor(c);
    await updateNoteMeta({ locale, id: initialNote.id, color: c });
  };

  const onTogglePin = async () => {
    const next = !isPinned;
    setIsPinned(next);
    await toggleNotePinned({ locale, id: initialNote.id, isPinned: next });
  };

  const onDelete = async () => {
    if (!window.confirm(t("deleteConfirm"))) return;
    const res = await deleteNote({ locale, id: initialNote.id });
    if (res.ok) router.push("/notes");
  };

  const statusLabel = () => {
    switch (saveStatus) {
      case "saving":
        return t("saving");
      case "saved":
        return t("saved");
      case "error":
        return tc("error");
      case "pending":
        return t("saving");
      default:
        return null;
    }
  };

  return (
    <FinancePageShell className="pb-24 md:pb-8">
      <header className="sticky top-0 z-20 -mx-4 border-b border-border-default bg-bg-sidebar px-4 py-3 shadow-sm md:-mx-6 md:px-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="shrink-0" asChild>
            <Link href="/notes" aria-label={t("back")}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={onTitleBlur}
            placeholder={t("titlePlaceholder")}
            className="h-9 flex-1 border-0 bg-transparent px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
          />
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => void onTogglePin()}
              aria-label={isPinned ? t("unpin") : t("pin")}>
              {isPinned ? (
                <PinOff className="h-4 w-4 text-accent" />
              ) : (
                <Pin className="h-4 w-4" />
              )}
            </Button>
            <ColorPicker
              value={color}
              onChange={(c) => void onColorChange(c)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-red-600"
              onClick={() => void onDelete()}
              aria-label={t("delete")}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {statusLabel() ? (
          <p className="mt-1 text-right text-xs text-text-muted">
            {statusLabel()}
          </p>
        ) : null}
      </header>

      <div className="mt-4 overflow-hidden rounded-xl border border-border-default">
        <RichTextEditor
          noteId={initialNote.id}
          userId={userId}
          initialContent={
            (initialNote.content_json as JSONContent | null) ?? EMPTY_TIPTAP_DOC
          }
          initialAttachments={initialNote.attachments}
          initialSketch={initialNote.sketch_data}
          onChange={scheduleSave}
        />
      </div>
    </FinancePageShell>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: NoteColor;
  onChange: (c: NoteColor) => void;
}) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("Finance.notes.form");

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("color")}>
        <Palette className="h-4 w-4" />
      </Button>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-1 flex gap-1 rounded-lg border border-border-default bg-bg-card p-2 shadow-lg dark:border-border-default bg-bg-card-nested">
          {NOTE_COLOR_OPTIONS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              className={cn(
                "h-6 w-6 rounded-full border-2",
                value === c
                  ? "border-zinc-900 dark:border-white"
                  : "border-transparent",
                noteColorDotClass(c),
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
