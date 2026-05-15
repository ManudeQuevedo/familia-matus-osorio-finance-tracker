-- Quick notes — ejecutar en Supabase SQL Editor
-- Usa public.set_updated_at() (mismo trigger que family_finance_schema.sql)

CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'note' CHECK (type IN ('note', 'reminder', 'todo')),
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  reminder_date TIMESTAMPTZ,
  color TEXT NOT NULL DEFAULT 'default',
  content_json JSONB,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  sketch_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migration for existing deployments (run if table was created before rich content):
-- See sql/notes_rich_content_migration.sql

CREATE INDEX IF NOT EXISTS notes_user_id_idx ON public.notes (user_id);
CREATE INDEX IF NOT EXISTS notes_reminder_date_idx ON public.notes (reminder_date)
  WHERE type = 'reminder';

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own notes" ON public.notes;
CREATE POLICY "Users can manage their own notes"
  ON public.notes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_notes_updated_at ON public.notes;
CREATE TRIGGER trg_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();
