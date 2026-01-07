-- Fix RLS recursion issue when querying profiles with embedded workspaces
-- The profiles and workspaces policies both query profiles table, causing recursion

-- Create a SECURITY DEFINER function to get current user's workspace_id
-- This bypasses RLS to avoid the recursion
CREATE OR REPLACE FUNCTION get_my_workspace_id()
RETURNS UUID AS $$
  SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own workspace" ON public.workspaces;
DROP POLICY IF EXISTS "Users can view workspace profiles" ON public.profiles;

-- Recreate policies using the helper function (no recursion)
CREATE POLICY "Users can view own workspace" ON public.workspaces
  FOR SELECT USING (id = get_my_workspace_id());

CREATE POLICY "Users can view workspace profiles" ON public.profiles
  FOR SELECT USING (workspace_id = get_my_workspace_id());
