-- Supabase Chat Persistence Schema
-- Migration: 001_initial_schema.sql
-- Description: Create tables for workspaces, profiles, conversations, and messages
-- with RLS policies for multi-tenant team isolation and full-text search

-- ============================================
-- 1. TABLES
-- ============================================

-- Workspaces (for team isolation)
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  teamwork_site_url TEXT,  -- Associated Teamwork site
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles (synced from Supabase Auth)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id),
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id TEXT,  -- Teamwork project ID (optional)
  topic TEXT CHECK (topic IN ('project', 'status', 'timelog', 'general')),
  title TEXT,  -- Auto-generated from first message
  search_vector TSVECTOR,  -- Full-text search
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user', 'assistant')),
  content TEXT,
  display_data JSONB,  -- Visualization data
  search_vector TSVECTOR,  -- Full-text search
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. INDEXES
-- ============================================

-- Full-text search indexes
CREATE INDEX conversations_search_idx ON public.conversations USING GIN(search_vector);
CREATE INDEX messages_search_idx ON public.messages USING GIN(search_vector);

-- Foreign key indexes for performance
CREATE INDEX profiles_workspace_idx ON public.profiles(workspace_id);
CREATE INDEX conversations_workspace_idx ON public.conversations(workspace_id);
CREATE INDEX conversations_user_idx ON public.conversations(user_id);
CREATE INDEX messages_conversation_idx ON public.messages(conversation_id);

-- Ordering indexes
CREATE INDEX conversations_updated_idx ON public.conversations(updated_at DESC);
CREATE INDEX messages_created_idx ON public.messages(created_at ASC);

-- ============================================
-- 3. FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update search vectors for messages
CREATE OR REPLACE FUNCTION update_message_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_search_trigger
  BEFORE INSERT OR UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION update_message_search_vector();

-- Auto-update conversation search vector (aggregates message content)
CREATE OR REPLACE FUNCTION update_conversation_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET search_vector = (
    SELECT to_tsvector('english', COALESCE(title, '') || ' ' ||
           COALESCE(string_agg(m.content, ' '), ''))
    FROM public.messages m
    WHERE m.conversation_id = NEW.conversation_id
  ),
  updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER conversation_search_trigger
  AFTER INSERT OR UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_search_vector();

-- Auto-update updated_at on conversations
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER conversation_timestamp_trigger
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION update_conversation_timestamp();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_workspace_id UUID;
BEGIN
  -- Check if a workspace exists for this email domain
  -- For now, create a personal workspace
  INSERT INTO public.workspaces (name)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'name', NEW.email) || '''s Workspace')
  RETURNING id INTO default_workspace_id;

  -- Create profile
  INSERT INTO public.profiles (id, workspace_id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    default_workspace_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 4. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Workspaces: users can only see their workspace
CREATE POLICY "Users can view own workspace" ON public.workspaces
  FOR SELECT USING (
    id IN (
      SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Profiles: users see teammates in same workspace
CREATE POLICY "Users can view workspace profiles" ON public.profiles
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- Conversations: users see all conversations in their workspace
CREATE POLICY "Users can view workspace conversations" ON public.conversations
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert workspace conversations" ON public.conversations
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own conversations" ON public.conversations
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own conversations" ON public.conversations
  FOR DELETE USING (user_id = auth.uid());

-- Messages: users see messages in workspace conversations
CREATE POLICY "Users can view workspace messages" ON public.messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT c.id FROM public.conversations c
      JOIN public.profiles p ON c.workspace_id = p.workspace_id
      WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages to workspace conversations" ON public.messages
  FOR INSERT WITH CHECK (
    conversation_id IN (
      SELECT c.id FROM public.conversations c
      JOIN public.profiles p ON c.workspace_id = p.workspace_id
      WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete messages from own conversations" ON public.messages
  FOR DELETE USING (
    conversation_id IN (
      SELECT id FROM public.conversations WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- 5. HELPER FUNCTIONS
-- ============================================

-- Full-text search across conversations and messages
CREATE OR REPLACE FUNCTION search_conversations(
  search_query TEXT,
  user_workspace_id UUID
)
RETURNS TABLE (
  conversation_id UUID,
  title TEXT,
  topic TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.title,
    c.topic,
    c.created_at,
    c.updated_at,
    ts_rank(c.search_vector, plainto_tsquery('english', search_query)) AS rank
  FROM public.conversations c
  WHERE c.workspace_id = user_workspace_id
    AND c.search_vector @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC, c.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
