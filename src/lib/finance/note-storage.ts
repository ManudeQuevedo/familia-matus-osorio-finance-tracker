import type { SupabaseClient } from "@supabase/supabase-js";

export const NOTE_ATTACHMENTS_BUCKET = "note-attachments";
const SIGNED_URL_TTL_SEC = 3600;

export type NoteAttachmentMeta = {
  name: string;
  path: string;
  type: string;
  size: number;
  url?: string;
};

export function noteAttachmentPath(
  userId: string,
  noteId: string,
  filename: string,
): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${userId}/${noteId}/${Date.now()}-${safe}`;
}

export async function uploadNoteFile(
  supabase: SupabaseClient,
  userId: string,
  noteId: string,
  file: File,
): Promise<{ path: string; signedUrl: string } | { error: string }> {
  const path = noteAttachmentPath(userId, noteId, file.name);
  const { error: uploadError } = await supabase.storage
    .from(NOTE_ATTACHMENTS_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) return { error: uploadError.message };

  const signed = await getNoteFileSignedUrl(supabase, path);
  if (!signed) return { error: "signed_url_failed" };

  return { path, signedUrl: signed };
}

export async function getNoteFileSignedUrl(
  supabase: SupabaseClient,
  path: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(NOTE_ATTACHMENTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SEC);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function deleteNoteStorageFile(
  supabase: SupabaseClient,
  path: string,
): Promise<void> {
  await supabase.storage.from(NOTE_ATTACHMENTS_BUCKET).remove([path]);
}

export async function refreshSignedUrlsInDoc(
  supabase: SupabaseClient,
  doc: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const clone = structuredClone(doc);

  const walk = async (node: Record<string, unknown>) => {
    if (node.type === "image" && node.attrs && typeof node.attrs === "object") {
      const attrs = node.attrs as Record<string, unknown>;
      const storagePath = attrs.storagePath;
      if (typeof storagePath === "string" && storagePath) {
        const url = await getNoteFileSignedUrl(supabase, storagePath);
        if (url) attrs.src = url;
      }
    }
    const content = node.content;
    if (Array.isArray(content)) {
      for (const child of content) {
        if (child && typeof child === "object") {
          await walk(child as Record<string, unknown>);
        }
      }
    }
  };

  await walk(clone);
  return clone;
}
