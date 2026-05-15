"use client";

import { FileText, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/finance/note-content";
import type { NoteAttachmentMeta } from "@/lib/finance/note-storage";
import { cn } from "@/lib/utils";

type NoteAttachmentListProps = {
  attachments: NoteAttachmentMeta[];
  onRemove?: (path: string) => void;
  className?: string;
};

export function NoteAttachmentList({
  attachments,
  onRemove,
  className,
}: NoteAttachmentListProps) {
  const t = useTranslations("Finance.notes.editor");

  if (attachments.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-medium text-text-muted">{t("attachments")}</p>
      <ul className="space-y-2">
        {attachments.map((file) => (
          <li
            key={file.path}
            className="flex items-center gap-3 rounded-lg border border-border-default bg-bg-card-nested/80 px-3 py-2 dark:border-border-default dark:bg-bg-card-nested">
            <FileText className="h-5 w-5 shrink-0 text-accent" />
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
              {file.name}
            </a>
            <span className="shrink-0 text-xs text-text-muted">
              {formatFileSize(file.size)}
            </span>
            {onRemove ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => onRemove(file.path)}
                aria-label={t("removeAttachment")}>
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
