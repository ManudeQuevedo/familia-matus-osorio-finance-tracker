"use server";

import type { JSONContent } from "@tiptap/react";
import { revalidatePath } from "next/cache";

import {
  EMPTY_TIPTAP_DOC,
  extractPlainText,
  textToTiptapDoc,
} from "@/lib/finance/note-content";
import type { NoteColor } from "@/lib/finance/note-colors";
import { NOTE_COLOR_OPTIONS } from "@/lib/finance/note-colors";
import type { NoteSketchData, NoteType } from "@/lib/finance/notes-queries";
import type { NoteAttachmentMeta } from "@/lib/finance/note-storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFamilyIdForUser } from "@/lib/supabase/family-core";

const NOTE_SELECT =
  "id, user_id, title, content, type, is_pinned, is_completed, reminder_date, color, content_json, attachments, sketch_data, created_at, updated_at";

function revalidateNotesPaths(locale: string, noteId?: string) {
  revalidatePath(`/${locale}/notes`, "page");
  revalidatePath(`/${locale}/dashboard`, "page");
  if (noteId) {
    revalidatePath(`/${locale}/notes/${noteId}`, "page");
  }
}

function parseNoteType(v: string): NoteType | null {
  if (v === "note" || v === "reminder" || v === "todo") return v;
  return null;
}

function parseNoteColor(v: string): NoteColor {
  return NOTE_COLOR_OPTIONS.includes(v as NoteColor)
    ? (v as NoteColor)
    : "default";
}

function normalizeAttachments(raw: unknown): NoteAttachmentMeta[] {
  return Array.isArray(raw) ? (raw as NoteAttachmentMeta[]) : [];
}

/** Plain text for DB + whether an empty TipTap doc is allowed (new/blank notes). */
function resolveNotePlainText(input: {
  content: string;
  contentJson?: JSONContent | null;
}): { plain: string; allowEmpty: boolean } {
  const fromText = input.content.trim();
  const fromJson = extractPlainText(input.contentJson ?? null);
  const allowEmpty =
    input.contentJson?.type === "doc" && !fromText && !fromJson;
  const plain = fromText || fromJson || "";
  return { plain, allowEmpty };
}

export async function createNote(input: {
  locale: string;
  title?: string;
  content: string;
  type: NoteType;
  reminderDate?: string | null;
  color?: string;
  contentJson?: JSONContent | null;
  attachments?: NoteAttachmentMeta[];
  sketchData?: NoteSketchData | null;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "unauthorized" };

  const { plain, allowEmpty } = resolveNotePlainText({
    content: input.content,
    contentJson: input.contentJson,
  });
  if (!plain && !allowEmpty) {
    return { ok: false as const, error: "content_required" };
  }

  const type = parseNoteType(input.type);
  if (!type) return { ok: false as const, error: "invalid_type" };

  const familyId = await getFamilyIdForUser(supabase, user.id);
  if (!familyId) return { ok: false as const, error: "family_not_configured" };

  const contentJson = input.contentJson ?? textToTiptapDoc(plain);

  const { data, error } = await supabase
    .from("notes")
    .insert({
      user_id: user.id,
      family_id: familyId,
      title: input.title?.trim() || null,
      content: plain,
      content_json: contentJson,
      attachments: input.attachments ?? [],
      sketch_data: input.sketchData ?? null,
      type,
      reminder_date:
        type === "reminder" && input.reminderDate ? input.reminderDate : null,
      color: parseNoteColor(input.color ?? "default"),
    })
    .select(NOTE_SELECT)
    .single();

  if (error) return { ok: false as const, error: error.message };

  revalidateNotesPaths(input.locale, data.id);
  return {
    ok: true as const,
    note: {
      ...data,
      attachments: normalizeAttachments(data.attachments),
    },
  };
}

export async function createEmptyNote(input: { locale: string }) {
  return createNote({
    locale: input.locale,
    content: "",
    type: "note",
    contentJson: EMPTY_TIPTAP_DOC,
  });
}

export async function updateNote(input: {
  locale: string;
  id: string;
  title?: string;
  content: string;
  type: NoteType;
  reminderDate?: string | null;
  color?: string;
  contentJson?: JSONContent | null;
  attachments?: NoteAttachmentMeta[];
  sketchData?: NoteSketchData | null;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "unauthorized" };

  const { plain, allowEmpty } = resolveNotePlainText({
    content: input.content,
    contentJson: input.contentJson,
  });
  if (!plain && !allowEmpty) {
    return { ok: false as const, error: "content_required" };
  }

  const type = parseNoteType(input.type);
  if (!type) return { ok: false as const, error: "invalid_type" };

  const payload: Record<string, unknown> = {
    title: input.title?.trim() || null,
    content: plain,
    type,
    reminder_date:
      type === "reminder" && input.reminderDate ? input.reminderDate : null,
    color: parseNoteColor(input.color ?? "default"),
  };

  if (input.contentJson !== undefined) payload.content_json = input.contentJson;
  if (input.attachments !== undefined) payload.attachments = input.attachments;
  if (input.sketchData !== undefined) payload.sketch_data = input.sketchData;

  const { data, error } = await supabase
    .from("notes")
    .update(payload)
    .eq("id", input.id)
    .select(NOTE_SELECT)
    .single();

  if (error) return { ok: false as const, error: error.message };

  revalidateNotesPaths(input.locale, input.id);
  return {
    ok: true as const,
    note: {
      ...data,
      attachments: normalizeAttachments(data.attachments),
    },
  };
}

/** Auto-save from the rich text editor (partial fields). */
export async function saveNoteContent(input: {
  locale: string;
  id: string;
  title?: string | null;
  content: string;
  contentJson: JSONContent;
  attachments?: NoteAttachmentMeta[];
  sketchData?: NoteSketchData | null;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "unauthorized" };

  const plain = input.content.trim() || extractPlainText(input.contentJson) || " ";

  const payload: Record<string, unknown> = {
    content: plain,
    content_json: input.contentJson,
  };

  if (input.title !== undefined) payload.title = input.title?.trim() || null;
  if (input.attachments !== undefined) payload.attachments = input.attachments;
  if (input.sketchData !== undefined) payload.sketch_data = input.sketchData;

  const { data, error } = await supabase
    .from("notes")
    .update(payload)
    .eq("id", input.id)
    .select(NOTE_SELECT)
    .single();

  if (error) return { ok: false as const, error: error.message };

  revalidateNotesPaths(input.locale, input.id);
  return {
    ok: true as const,
    note: {
      ...data,
      attachments: normalizeAttachments(data.attachments),
    },
    savedAt: new Date().toISOString(),
  };
}

export async function updateNoteMeta(input: {
  locale: string;
  id: string;
  title?: string | null;
  color?: string;
  isPinned?: boolean;
  type?: NoteType;
  reminderDate?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "unauthorized" };

  const payload: Record<string, unknown> = {};
  if (input.title !== undefined) payload.title = input.title?.trim() || null;
  if (input.color !== undefined) payload.color = parseNoteColor(input.color);
  if (input.isPinned !== undefined) payload.is_pinned = input.isPinned;
  if (input.type !== undefined) {
    const type = parseNoteType(input.type);
    if (!type) return { ok: false as const, error: "invalid_type" };
    payload.type = type;
    payload.reminder_date =
      type === "reminder" && input.reminderDate ? input.reminderDate : null;
  }

  const { data, error } = await supabase
    .from("notes")
    .update(payload)
    .eq("id", input.id)
    .select(NOTE_SELECT)
    .single();

  if (error) return { ok: false as const, error: error.message };

  revalidateNotesPaths(input.locale, input.id);
  return {
    ok: true as const,
    note: {
      ...data,
      attachments: normalizeAttachments(data.attachments),
    },
  };
}

export async function deleteNote(input: { locale: string; id: string }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "unauthorized" };

  const { error } = await supabase
    .from("notes")
    .delete()
    .eq("id", input.id);

  if (error) return { ok: false as const, error: error.message };

  revalidateNotesPaths(input.locale);
  return { ok: true as const };
}

export async function toggleNotePinned(input: {
  locale: string;
  id: string;
  isPinned: boolean;
}) {
  return updateNoteMeta({
    locale: input.locale,
    id: input.id,
    isPinned: input.isPinned,
  });
}

export async function toggleNoteCompleted(input: {
  locale: string;
  id: string;
  isCompleted: boolean;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "unauthorized" };

  const { data, error } = await supabase
    .from("notes")
    .update({ is_completed: input.isCompleted })
    .eq("id", input.id)
    .select(NOTE_SELECT)
    .single();

  if (error) return { ok: false as const, error: error.message };

  revalidateNotesPaths(input.locale, input.id);
  return {
    ok: true as const,
    note: {
      ...data,
      attachments: normalizeAttachments(data.attachments),
    },
  };
}
