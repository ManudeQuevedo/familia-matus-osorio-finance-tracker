"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  CheckSquare,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Paperclip,
  Pencil,
  Strikethrough,
  Underline as UnderlineIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { SketchPanel } from "@/components/notes/sketch-panel";
import { NoteAttachmentList } from "@/components/notes/note-attachment-list";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EMPTY_TIPTAP_DOC, extractPlainText } from "@/lib/finance/note-content";
import type { NoteSketchData } from "@/lib/finance/notes-queries";
import type { NoteAttachmentMeta } from "@/lib/finance/note-storage";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  getNoteFileSignedUrl,
  uploadNoteFile,
} from "@/lib/finance/note-storage";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";

const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      storagePath: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-storage-path"),
        renderHTML: (attrs) => {
          if (!attrs.storagePath) return {};
          return { "data-storage-path": attrs.storagePath as string };
        },
      },
    };
  },
});

export type RichTextEditorChange = {
  contentJson: JSONContent;
  plainText: string;
  attachments: NoteAttachmentMeta[];
  sketchData: NoteSketchData | null;
};

export type RichTextEditorProps = {
  noteId: string;
  userId: string;
  initialContent?: JSONContent | null;
  initialAttachments?: NoteAttachmentMeta[];
  initialSketch?: NoteSketchData | null;
  placeholder?: string;
  onChange?: (payload: RichTextEditorChange) => void;
  className?: string;
};

async function resolveImageUrls(doc: JSONContent): Promise<JSONContent> {
  const supabase = createSupabaseBrowserClient();
  const clone = structuredClone(doc) as JSONContent;

  const walk = async (node: JSONContent) => {
    if (node.type === "image" && node.attrs?.storagePath) {
      const url = await getNoteFileSignedUrl(
        supabase,
        node.attrs.storagePath as string,
      );
      if (url) node.attrs = { ...node.attrs, src: url };
    }
    if (node.content) {
      for (const child of node.content) await walk(child);
    }
  };

  await walk(clone);
  return clone;
}

export function RichTextEditor(props: RichTextEditorProps) {
  const [docReady, setDocReady] = useState(false);
  const [resolvedDoc, setResolvedDoc] = useState<JSONContent>(
    props.initialContent ?? EMPTY_TIPTAP_DOC,
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setDocReady(false);
      const base = props.initialContent ?? EMPTY_TIPTAP_DOC;
      const resolved = await resolveImageUrls(base);
      if (!cancelled) {
        setResolvedDoc(resolved);
        setDocReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.initialContent]);

  if (!docReady) {
    return (
      <div
        className={cn(
          "animate-pulse rounded-lg bg-bg-card-nested p-8",
          props.className,
        )}>
        <div className="h-8 w-full rounded bg-bg-card-hover" />
        <div className="mt-4 h-48 rounded bg-bg-card-hover" />
      </div>
    );
  }

  return (
    <RichTextEditorContent
      key={props.noteId}
      {...props}
      resolvedDoc={resolvedDoc}
    />
  );
}

function RichTextEditorContent({
  noteId,
  userId,
  initialAttachments = [],
  initialSketch,
  placeholder,
  onChange,
  className,
  resolvedDoc,
}: RichTextEditorProps & { resolvedDoc: JSONContent }) {
  const t = useTranslations("Finance.notes.editor");
  const imageInputId = useId();
  const fileInputId = useId();

  const [attachments, setAttachments] =
    useState<NoteAttachmentMeta[]>(initialAttachments);
  const [sketchOpen, setSketchOpen] = useState(false);
  const [sketchData, setSketchData] = useState<NoteSketchData | null>(
    initialSketch ?? null,
  );
  const exportSketchRef = useRef<(() => Promise<string>) | null>(null);

  const emitChange = useCallback(
    (
      json: JSONContent,
      nextAttachments = attachments,
      nextSketch = sketchData,
    ) => {
      onChange?.({
        contentJson: json,
        plainText: extractPlainText(json),
        attachments: nextAttachments,
        sketchData: nextSketch,
      });
    },
    [attachments, sketchData, onChange],
  );

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          // StarterKit v3 bundles link + underline; disable to avoid duplicates.
          link: false,
          underline: false,
        }),
        Underline,
        Link.configure({ autolink: true, openOnClick: false }),
        CustomImage.configure({ inline: false, allowBase64: false }),
        TaskList,
        TaskItem.configure({ nested: true }),
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        Typography,
        Placeholder.configure({
          placeholder: placeholder ?? t("placeholder"),
        }),
      ],
      content: resolvedDoc,
      editable: true,
      immediatelyRender: false,
      onUpdate: ({ editor: ed }) => {
        emitChange(ed.getJSON());
      },
      editorProps: {
        attributes: {
          class: "tiptap min-h-[280px] px-4 py-3 focus:outline-none",
        },
      },
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createSupabaseBrowserClient();
      const refreshed = await Promise.all(
        initialAttachments.map(async (a) => {
          const url = await getNoteFileSignedUrl(supabase, a.path);
          return url ? { ...a, url } : a;
        }),
      );
      if (!cancelled) setAttachments(refreshed);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialAttachments]);

  const uploadImage = async (file: File) => {
    if (!editor) return;
    if (file.size > 500 * 1024) {
      const supabase = createSupabaseBrowserClient();
      const result = await uploadNoteFile(supabase, userId, noteId, file);
      if ("error" in result) {
        notify.notes.attachmentError();
        return;
      }
      editor
        .chain()
        .focus()
        .setImage({
          src: result.signedUrl,
          alt: file.name,
          storagePath: result.path,
        } as { src: string; alt?: string; storagePath?: string })
        .run();
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      editor.chain().focus().setImage({ src, alt: file.name }).run();
    };
    reader.readAsDataURL(file);
  };

  const uploadAttachment = async (file: File) => {
    const supabase = createSupabaseBrowserClient();
    const result = await uploadNoteFile(supabase, userId, noteId, file);
    if ("error" in result) {
      notify.notes.attachmentError();
      return;
    }
    const meta: NoteAttachmentMeta = {
      name: file.name,
      path: result.path,
      type: file.type,
      size: file.size,
      url: result.signedUrl,
    };
    const next = [...attachments, meta];
    setAttachments(next);
    if (editor) emitChange(editor.getJSON(), next, sketchData);
  };

  const removeAttachment = async (path: string) => {
    const next = attachments.filter((a) => a.path !== path);
    setAttachments(next);
    if (editor) emitChange(editor.getJSON(), next, sketchData);
  };

  const setLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(t("linkPrompt"), prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const headingValue = () => {
    if (!editor) return "paragraph";
    if (editor.isActive("heading", { level: 1 })) return "h1";
    if (editor.isActive("heading", { level: 2 })) return "h2";
    if (editor.isActive("heading", { level: 3 })) return "h3";
    return "paragraph";
  };

  const onHeadingChange = (value: string) => {
    if (!editor) return;
    if (value === "paragraph") {
      editor.chain().focus().setParagraph().run();
    } else if (value === "h1") {
      editor.chain().focus().toggleHeading({ level: 1 }).run();
    } else if (value === "h2") {
      editor.chain().focus().toggleHeading({ level: 2 }).run();
    } else if (value === "h3") {
      editor.chain().focus().toggleHeading({ level: 3 }).run();
    }
  };

  const handleSketchToggle = async () => {
    if (sketchOpen && exportSketchRef.current) {
      const svg = await exportSketchRef.current();
      const next: NoteSketchData = { svg };
      setSketchData(next);
      if (editor) emitChange(editor.getJSON(), attachments, next);
    }
    setSketchOpen((o) => !o);
  };

  if (!editor) {
    return (
      <div
        className={cn(
          "animate-pulse rounded-lg bg-bg-card-nested p-8",
          className,
        )}>
        <div className="h-8 w-full rounded bg-bg-card-hover" />
        <div className="mt-4 h-48 rounded bg-bg-card-hover" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("flex flex-col", className)}>
        <div className="sticky top-0 z-10 flex items-center gap-0.5 overflow-x-auto border-b border-border-default bg-background px-2 py-2 dark:border-border-default">
          <Select value={headingValue()} onValueChange={onHeadingChange}>
            <SelectTrigger className="h-8 w-[120px] shrink-0 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="paragraph">{t("paragraph")}</SelectItem>
              <SelectItem value="h1">{t("heading1")}</SelectItem>
              <SelectItem value="h2">{t("heading2")}</SelectItem>
              <SelectItem value="h3">{t("heading3")}</SelectItem>
            </SelectContent>
          </Select>

          <ToolbarDivider />

          <ToolbarBtn
            label={t("bold")}
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            label={t("italic")}
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            label={t("underline")}
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            label={t("strike")}
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}>
            <Strikethrough className="h-4 w-4" />
          </ToolbarBtn>

          <ToolbarDivider />

          <ToolbarBtn
            label={t("alignLeft")}
            active={editor.isActive({ textAlign: "left" })}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}>
            <AlignLeft className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            label={t("alignCenter")}
            active={editor.isActive({ textAlign: "center" })}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}>
            <AlignCenter className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            label={t("alignRight")}
            active={editor.isActive({ textAlign: "right" })}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}>
            <AlignRight className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            label={t("alignJustify")}
            active={editor.isActive({ textAlign: "justify" })}
            onClick={() =>
              editor.chain().focus().setTextAlign("justify").run()
            }>
            <AlignJustify className="h-4 w-4" />
          </ToolbarBtn>

          <ToolbarDivider />

          <ToolbarBtn
            label={t("bulletList")}
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            label={t("orderedList")}
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            label={t("taskList")}
            active={editor.isActive("taskList")}
            onClick={() => editor.chain().focus().toggleTaskList().run()}>
            <CheckSquare className="h-4 w-4" />
          </ToolbarBtn>

          <ToolbarDivider />

          <ToolbarBtn label={t("link")} onClick={setLink}>
            <Link2 className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            label={t("image")}
            onClick={() => document.getElementById(imageInputId)?.click()}>
            <ImageIcon className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            label={t("attach")}
            onClick={() => document.getElementById(fileInputId)?.click()}>
            <Paperclip className="h-4 w-4" />
          </ToolbarBtn>

          <ToolbarDivider />

          <ToolbarBtn
            label={t("sketchToggle")}
            active={sketchOpen}
            onClick={() => void handleSketchToggle()}>
            <Pencil className="h-4 w-4" />
          </ToolbarBtn>
        </div>

        <input
          id={imageInputId}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadImage(file);
            e.target.value = "";
          }}
        />
        <input
          id={fileInputId}
          type="file"
          accept=".pdf,image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadAttachment(file);
            e.target.value = "";
          }}
        />

        {sketchOpen ? (
          <SketchPanel
            initialSvg={sketchData?.svg}
            onExportReady={(fn) => {
              exportSketchRef.current = fn;
            }}
          />
        ) : null}

        <EditorContent editor={editor} />

        <NoteAttachmentList
          attachments={attachments}
          onRemove={(path) => void removeAttachment(path)}
          className="border-t border-border-default px-4 py-3 dark:border-border-default"
        />

        {!sketchOpen && sketchData?.svg ? (
          <div className="space-y-2 border-t border-border-default px-4 py-4 dark:border-border-default">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-text-secondary dark:text-text-muted">
                {t("sketchPreview")}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSketchOpen(true)}>
                {t("editSketch")}
              </Button>
            </div>
            <div
              className="overflow-hidden rounded-lg border border-border-default bg-bg-card dark:border-border-default"
              dangerouslySetInnerHTML={{ __html: sketchData.svg }}
            />
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}

function ToolbarBtn({
  children,
  label,
  active,
  onClick,
}: {
  children: ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 shrink-0 rounded-md",
            active && "bg-accent-muted text-accent",
          )}
          onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function ToolbarDivider() {
  return (
    <span className="mx-0.5 h-6 w-px shrink-0 bg-zinc-200 dark:bg-zinc-700" />
  );
}
