"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

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
import {
  NOTE_COLOR_OPTIONS,
  noteColorDotClass,
  type NoteColor,
} from "@/lib/finance/note-colors";
import type { NoteRow, NoteType } from "@/lib/finance/notes-queries";
import { useEscape } from "@/lib/hooks/use-escape";
import { cn } from "@/lib/utils";

export type NoteFormValues = {
  type: NoteType;
  title: string;
  content: string;
  reminderDate: string;
  reminderTime: string;
  color: NoteColor;
};

function defaultReminderParts() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return {
    date: d.toISOString().slice(0, 10),
    time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  };
}

export function noteToFormValues(note?: NoteRow | null): NoteFormValues {
  const { date, time } = defaultReminderParts();
  if (!note) {
    return {
      type: "note",
      title: "",
      content: "",
      reminderDate: date,
      reminderTime: time,
      color: "default",
    };
  }
  let reminderDate = date;
  let reminderTime = time;
  if (note.reminder_date) {
    const rd = new Date(note.reminder_date);
    reminderDate = rd.toISOString().slice(0, 10);
    reminderTime = `${String(rd.getHours()).padStart(2, "0")}:${String(rd.getMinutes()).padStart(2, "0")}`;
  }
  return {
    type: note.type,
    title: note.title ?? "",
    content: note.content,
    reminderDate,
    reminderTime,
    color: (NOTE_COLOR_OPTIONS.includes(note.color as NoteColor)
      ? note.color
      : "default") as NoteColor,
  };
}

export function formValuesToReminderIso(
  date: string,
  time: string,
): string | null {
  if (!date) return null;
  const t = time || "09:00";
  const d = new Date(`${date}T${t}:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function TypePills({
  options,
  value,
  onChange,
}: {
  options: { key: NoteType; label: string }[];
  value: NoteType;
  onChange: (type: NoteType) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium transition",
            value === opt.key
              ? "bg-accent-muted text-accent"
              : "bg-bg-card-nested text-text-secondary hover:bg-bg-card-hover dark:text-text-muted dark:hover:bg-bg-card-nested",
          )}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function NoteFormBody({
  values,
  onChange,
  contentRef,
  t,
}: {
  values: NoteFormValues;
  onChange: (values: NoteFormValues) => void;
  contentRef: React.RefObject<HTMLTextAreaElement | null>;
  t: ReturnType<typeof useTranslations<"Finance.notes">>;
}) {
  const typeOptions: { key: NoteType; label: string }[] = [
    { key: "note", label: t("types.note") },
    { key: "reminder", label: t("types.reminder") },
    { key: "todo", label: t("types.todo") },
  ];

  const contentPlaceholder =
    values.type === "reminder"
      ? t("form.contentReminder")
      : values.type === "todo"
        ? t("form.contentTodo")
        : t("form.contentNote");

  return (
    <div className="space-y-4">
      <TypePills
        options={typeOptions}
        value={values.type}
        onChange={(type) => onChange({ ...values, type })}
      />
      <div>
        <Label htmlFor="note-title">{t("form.title")}</Label>
        <Input
          id="note-title"
          className="mt-1.5"
          value={values.title}
          onChange={(e) => onChange({ ...values, title: e.target.value })}
          placeholder={t("form.titlePlaceholder")}
        />
      </div>
      <NoteFormBodyFields
        values={values}
        onChange={onChange}
        contentPlaceholder={contentPlaceholder}
        contentRef={contentRef}
        t={t}
      />
    </div>
  );
}

function NoteFormBodyFields({
  values,
  onChange,
  contentPlaceholder,
  contentRef,
  t,
}: {
  values: NoteFormValues;
  onChange: (values: NoteFormValues) => void;
  contentPlaceholder: string;
  contentRef: React.RefObject<HTMLTextAreaElement | null>;
  t: ReturnType<typeof useTranslations<"Finance.notes">>;
}) {
  return (
    <>
      <div>
        <Label htmlFor="note-content">{t("form.contentLabel")}</Label>
        <textarea
          ref={contentRef}
          id="note-content"
          rows={4}
          className="mt-1.5 flex w-full rounded-md border border-border-default bg-bg-card px-3 py-2 text-sm shadow-sm placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          value={values.content}
          onChange={(e) => onChange({ ...values, content: e.target.value })}
          placeholder={contentPlaceholder}
        />
      </div>
      {values.type === "reminder" ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="reminder-date">{t("form.reminderDate")}</Label>
            <Input
              id="reminder-date"
              type="date"
              className="mt-1.5"
              value={values.reminderDate}
              onChange={(e) =>
                onChange({ ...values, reminderDate: e.target.value })
              }
            />
          </div>
          <div>
            <Label htmlFor="reminder-time">{t("form.reminderTime")}</Label>
            <Input
              id="reminder-time"
              type="time"
              className="mt-1.5"
              value={values.reminderTime}
              onChange={(e) =>
                onChange({ ...values, reminderTime: e.target.value })
              }
            />
          </div>
        </div>
      ) : null}
      <div>
        <Label>{t("form.color")}</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {NOTE_COLOR_OPTIONS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ ...values, color: c })}
              className={cn(
                "h-7 w-7 rounded-full border-2 transition",
                values.color === c
                  ? "border-zinc-900 dark:border-white"
                  : "border-transparent",
                noteColorDotClass(c),
              )}
              aria-label={c}
            />
          ))}
        </div>
      </div>
    </>
  );
}

type NoteFormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDesktop: boolean;
  values: NoteFormValues;
  onChange: (values: NoteFormValues) => void;
  onSave: () => void;
  saving: boolean;
  editing: boolean;
  focusContent?: boolean;
};

export function NoteFormModal({
  open,
  onOpenChange,
  isDesktop,
  values,
  onChange,
  onSave,
  saving,
  editing,
  focusContent,
}: NoteFormModalProps) {
  const t = useTranslations("Finance.notes");
  const tc = useTranslations("Finance.common");
  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEscape(() => onOpenChange(false), open);

  useEffect(() => {
    if (open && focusContent) {
      const id = window.setTimeout(() => contentRef.current?.focus(), 120);
      return () => window.clearTimeout(id);
    }
  }, [open, focusContent]);

  const formBody = (
    <NoteFormBody
      values={values}
      onChange={onChange}
      contentRef={contentRef}
      t={t}
    />
  );

  const footer = (
    <Button
      className="w-full"
      disabled={saving || !values.content.trim()}
      onClick={onSave}>
      {saving ? tc("saving") : tc("save")}
    </Button>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? t("form.editTitle") : t("form.newTitle")}
            </DialogTitle>
          </DialogHeader>
          {formBody}
          <div className="mt-4">{footer}</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <AnimatedBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? t("form.editTitle") : t("form.newTitle")}
      footer={footer}>
      {formBody}
    </AnimatedBottomSheet>
  );
}
