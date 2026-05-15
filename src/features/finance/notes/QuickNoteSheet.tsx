"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { AnimatedBottomSheet } from "@/components/motion/AnimatedBottomSheet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { textToTiptapDoc } from "@/lib/finance/note-content";
import { createNote } from "@/lib/finance/notes-actions";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type QuickNoteSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDesktop: boolean;
  locale: string;
  onSaved?: (noteId: string) => void;
};

export function QuickNoteSheet({
  open,
  onOpenChange,
  isDesktop,
  locale,
  onSaved,
}: QuickNoteSheetProps) {
  const t = useTranslations("Finance.notes.quick");
  const tc = useTranslations("Finance.common");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  const reset = () => {
    setTitle("");
    setContent("");
    setSavedNoteId(null);
    setToastVisible(false);
  };

  const handleSave = async () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    setSaving(true);
    const res = await createNote({
      locale,
      title,
      content: trimmed,
      type: "note",
      contentJson: textToTiptapDoc(trimmed),
    });
    setSaving(false);
    if (res.ok && res.note) {
      setSavedNoteId(res.note.id);
      setToastVisible(true);
      onSaved?.(res.note.id);
      setTitle("");
      setContent("");
      onOpenChange(false);
    }
  };

  const form = (
    <div className="space-y-4">
      <div>
        <Label htmlFor="quick-note-title">{t("title")}</Label>
        <Input
          id="quick-note-title"
          className="mt-1.5"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("titlePlaceholder")}
        />
      </div>
      <div>
        <Label htmlFor="quick-note-content">{t("content")}</Label>
        <textarea
          id="quick-note-content"
          rows={4}
          className="mt-1.5 flex w-full rounded-md border border-border-default bg-bg-card px-3 py-2 text-sm shadow-sm placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:border-border-default bg-bg-card"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("contentPlaceholder")}
        />
      </div>
    </div>
  );

  const footer = (
    <Button
      className="w-full bg-accent text-accent-foreground hover:bg-accent-hover"
      disabled={saving || !content.trim()}
      onClick={() => void handleSave()}>
      {saving ? tc("saving") : tc("save")}
    </Button>
  );

  return (
    <>
      {isDesktop ? (
        <Dialog
          open={open}
          onOpenChange={(v) => {
            onOpenChange(v);
            if (!v) reset();
          }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("titleDialog")}</DialogTitle>
            </DialogHeader>
            {form}
            <div className="mt-4">{footer}</div>
          </DialogContent>
        </Dialog>
      ) : (
        <AnimatedBottomSheet
          open={open}
          onOpenChange={(v) => {
            onOpenChange(v);
            if (!v) reset();
          }}
          title={t("titleDialog")}
          footer={footer}>
          {form}
        </AnimatedBottomSheet>
      )}

      {toastVisible && savedNoteId ? (
        <QuickNoteToast
          noteId={savedNoteId}
          message={t("savedToast")}
          openLabel={t("openEditor")}
          onDismiss={() => {
            setToastVisible(false);
            setSavedNoteId(null);
          }}
        />
      ) : null}
    </>
  );
}

function QuickNoteToast({
  noteId,
  message,
  openLabel,
  onDismiss,
}: {
  noteId: string;
  message: string;
  openLabel: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      className={cn(
        "fixed bottom-24 left-4 right-4 z-[60] flex items-center justify-between gap-3 rounded-xl border border-border-default bg-bg-card px-4 py-3 shadow-lg",
        "dark:border-border-default bg-bg-card-nested md:bottom-8 md:left-auto md:right-8 md:max-w-sm",
      )}>
      <p className="text-sm font-medium">{message}</p>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="outline" asChild onClick={onDismiss}>
          <Link href={`/notes/${noteId}`}>{openLabel}</Link>
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          ×
        </Button>
      </div>
    </div>
  );
}
