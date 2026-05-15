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
import { triggerHaptic } from "@/lib/haptic";
import { useEscape } from "@/lib/hooks/use-escape";
import { notify } from "@/lib/toast";
import { useRouter } from "@/i18n/navigation";

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
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle("");
    setContent("");
  };

  useEscape(() => {
    onOpenChange(false);
    reset();
  }, open);

  const handleSave = async () => {
    const trimmed = content.trim();
    if (!trimmed) {
      triggerHaptic("heavy");
      return;
    }
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
      triggerHaptic("light");
      notify.notes.createSuccessWithOpen({
        openLabel: t("openEditor"),
        navigate: () => router.push(`/notes/${res.note.id}`),
      });
      onSaved?.(res.note.id);
      setTitle("");
      setContent("");
      onOpenChange(false);
      return;
    }
    notify.notes.createError();
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
          className="mt-1.5 flex min-h-28 w-full rounded-md border border-border-default bg-bg-card px-3 py-2 text-base shadow-sm placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:text-sm"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("contentPlaceholder")}
        />
      </div>
    </div>
  );

  const footer = (
    <Button
      className="w-full"
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
    </>
  );
}
