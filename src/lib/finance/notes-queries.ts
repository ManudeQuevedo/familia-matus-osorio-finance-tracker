import type { JSONContent } from "@tiptap/react";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { NoteAttachmentMeta } from "@/lib/finance/note-storage";
import { getFamilyIdForUser } from "@/lib/supabase/family-core";

export type NoteType = "note" | "reminder" | "todo";

export type NoteSketchData = {
  svg: string;
  paths?: unknown;
};

export type NoteRow = {
  id: string;
  user_id: string;
  title: string | null;
  content: string;
  type: NoteType;
  is_pinned: boolean;
  is_completed: boolean;
  reminder_date: string | null;
  color: string;
  content_json: JSONContent | null;
  attachments: NoteAttachmentMeta[];
  sketch_data: NoteSketchData | null;
  created_at: string;
  updated_at: string;
};

const NOTE_SELECT =
  "id, user_id, title, content, type, is_pinned, is_completed, reminder_date, color, content_json, attachments, sketch_data, created_at, updated_at";

export type NotesSnapshot = {
  notes: NoteRow[];
};

export type TodayReminder = {
  id: string;
  title: string | null;
  content: string;
  reminder_date: string;
};

function startOfLocalDay(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfLocalDay(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export async function fetchNotesSnapshot(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: NotesSnapshot | null; error: string | null }> {
  try {
    const familyId = await getFamilyIdForUser(supabase, userId);
    if (!familyId) {
      return { data: null, error: "family_not_configured" };
    }

    const { data, error } = await supabase
      .from("notes")
      .select(NOTE_SELECT)
      .eq("family_id", familyId)
      .order("is_pinned", { ascending: false })
      .order("updated_at", { ascending: false });

    if (error) throw error;

    return {
      data: { notes: normalizeNoteRows(data ?? []) },
      error: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load notes";
    return { data: null, error: msg };
  }
}

export async function fetchTodayReminders(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: TodayReminder[]; error: string | null }> {
  try {
    const start = startOfLocalDay().toISOString();
    const end = endOfLocalDay().toISOString();

    const familyId = await getFamilyIdForUser(supabase, userId);
    if (!familyId) {
      // No family row yet (or family_members unreadable): treat as zero reminders.
      // Returning an error would make /api/finance/notes?todayReminders=1 return 500 on the dashboard.
      return { data: [], error: null };
    }

    const { data, error } = await supabase
      .from("notes")
      .select("id, title, content, reminder_date")
      .eq("family_id", familyId)
      .eq("type", "reminder")
      .eq("is_completed", false)
      .gte("reminder_date", start)
      .lte("reminder_date", end)
      .order("reminder_date", { ascending: true });

    if (error) throw error;

    return { data: (data ?? []) as TodayReminder[], error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load reminders";
    return { data: [], error: msg };
  }
}

function normalizeNoteRow(row: Record<string, unknown>): NoteRow {
  return {
    ...(row as NoteRow),
    attachments: Array.isArray(row.attachments)
      ? (row.attachments as NoteAttachmentMeta[])
      : [],
    content_json: (row.content_json as JSONContent | null) ?? null,
    sketch_data: (row.sketch_data as NoteSketchData | null) ?? null,
  };
}

function normalizeNoteRows(rows: Record<string, unknown>[]): NoteRow[] {
  return rows.map(normalizeNoteRow);
}

export async function fetchNoteById(
  supabase: SupabaseClient,
  userId: string,
  noteId: string,
): Promise<{ data: NoteRow | null; error: string | null }> {
  try {
    const familyId = await getFamilyIdForUser(supabase, userId);
    if (!familyId) {
      return { data: null, error: "family_not_configured" };
    }

    const { data, error } = await supabase
      .from("notes")
      .select(NOTE_SELECT)
      .eq("family_id", familyId)
      .eq("id", noteId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { data: null, error: "not_found" };

    return { data: normalizeNoteRow(data), error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load note";
    return { data: null, error: msg };
  }
}

export function getReminderStatus(
  reminderDateIso: string | null,
  now = new Date(),
): "none" | "overdue" | "today" | "upcoming" {
  if (!reminderDateIso) return "none";
  const d = new Date(reminderDateIso);
  const todayStart = startOfLocalDay(now);
  const todayEnd = endOfLocalDay(now);
  if (d < todayStart) return "overdue";
  if (d <= todayEnd) return "today";
  return "upcoming";
}
