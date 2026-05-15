-- AI conversational advisor — run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_conversations_user_updated_idx
  ON public.ai_conversations (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_messages_conversation_created_idx
  ON public.ai_messages (conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS ai_messages_user_created_idx
  ON public.ai_messages (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_financial_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_financial_snapshots_user_created_idx
  ON public.ai_financial_snapshots (user_id, created_at DESC);

DROP TRIGGER IF EXISTS ai_conversations_set_updated_at ON public.ai_conversations;
CREATE TRIGGER ai_conversations_set_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_financial_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own conversations" ON public.ai_conversations;
CREATE POLICY "Users manage own conversations"
  ON public.ai_conversations
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own messages" ON public.ai_messages;
CREATE POLICY "Users manage own messages"
  ON public.ai_messages
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own snapshots" ON public.ai_financial_snapshots;
CREATE POLICY "Users manage own snapshots"
  ON public.ai_financial_snapshots
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
