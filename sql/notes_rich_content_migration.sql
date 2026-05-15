-- Add rich note fields to an existing public.notes table.
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS content_json JSONB;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS sketch_data JSONB;
