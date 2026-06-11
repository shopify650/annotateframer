-- Run this in your Supabase SQL Editor
-- This adds missing tables/columns for ClickUp integration
-- WITHOUT DROPPING EXISTING DATA

-- 1. Add ClickUp columns to projects
ALTER TABLE IF EXISTS projects
  ADD COLUMN IF NOT EXISTS clickup_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS clickup_api_token TEXT,
  ADD COLUMN IF NOT EXISTS clickup_workspace_id TEXT,
  ADD COLUMN IF NOT EXISTS clickup_space_id TEXT,
  ADD COLUMN IF NOT EXISTS clickup_folder_id TEXT,
  ADD COLUMN IF NOT EXISTS clickup_list_id TEXT,
  ADD COLUMN IF NOT EXISTS clickup_assignee_id TEXT,
  ADD COLUMN IF NOT EXISTS clickup_auto_sync BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS clickup_page_url_field_id TEXT,
  ADD COLUMN IF NOT EXISTS clickup_website_field_id TEXT;

-- 2. Add ClickUp columns to comments
ALTER TABLE IF EXISTS comments
  ADD COLUMN IF NOT EXISTS clickup_task_id TEXT,
  ADD COLUMN IF NOT EXISTS clickup_task_url TEXT,
  ADD COLUMN IF NOT EXISTS clickup_synced BOOLEAN DEFAULT false;

-- 3. Create login_sessions table (for OAuth) if it doesn't exist
CREATE TABLE IF NOT EXISTS login_sessions (
  id uuid primary key,
  access_token text not null,
  refresh_token text not null,
  created_at timestamptz default now()
);

-- 4. Enable RLS on login_sessions if not enabled
ALTER TABLE IF EXISTS login_sessions enable row level security;

-- 5. Create RLS policies for login_sessions if they don't exist
DROP POLICY IF EXISTS "Anyone can insert login sessions" ON login_sessions;
DROP POLICY IF EXISTS "Anyone can read login sessions" ON login_sessions;
DROP POLICY IF EXISTS "Anyone can delete login sessions" ON login_sessions;

CREATE POLICY "Anyone can insert login sessions" ON login_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read login sessions" ON login_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can delete login sessions" ON login_sessions FOR DELETE USING (true);

-- 6. Add ClickUp indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_token ON projects(invite_token);