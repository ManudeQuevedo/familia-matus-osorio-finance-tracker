-- Profile accent color + avatars storage bucket
-- Run in Supabase SQL Editor after family_finance_schema.sql

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS accent_color TEXT NOT NULL DEFAULT 'emerald'
  CHECK (accent_color IN ('emerald', 'blue', 'purple', 'rose', 'amber', 'slate'));

COMMENT ON COLUMN public.profiles.accent_color IS 'UI accent preset key';

-- -----------------------------------------------------------------------------
-- Storage: avatars bucket (create in Dashboard or via API if not exists)
-- Public bucket, 2MB max, image/jpeg|png|webp
-- Path pattern: {user_id}/profile.{ext}
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read
DROP POLICY IF EXISTS "avatars_select_public" ON storage.objects;
CREATE POLICY "avatars_select_public"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- Owner insert (folder name = auth.uid())
DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner update
DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner delete (optional, for future remove-avatar)
DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
