-- Note attachments storage bucket — run after notes_schema.sql
-- Path: note-attachments/{user_id}/{note_id}/{filename}

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'note-attachments',
  'note-attachments',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Owner can read own files
DROP POLICY IF EXISTS "note_attachments_select_own" ON storage.objects;
CREATE POLICY "note_attachments_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'note-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can upload to own folder / note
DROP POLICY IF EXISTS "note_attachments_insert_own" ON storage.objects;
CREATE POLICY "note_attachments_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'note-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can update own files
DROP POLICY IF EXISTS "note_attachments_update_own" ON storage.objects;
CREATE POLICY "note_attachments_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'note-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'note-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can delete own files
DROP POLICY IF EXISTS "note_attachments_delete_own" ON storage.objects;
CREATE POLICY "note_attachments_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'note-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
