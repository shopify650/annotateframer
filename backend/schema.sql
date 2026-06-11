-- =============================================
-- ANNOTATEFRAME — Full Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- =============================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── PROJECTS ──────────────────────────────────────────────────────────────
-- Each Framer site = one project, owned by one agency user
create table if not exists projects (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references auth.users(id) on delete cascade,
  name                  text not null default 'My Framer Project',
  site_url              text,
  invite_token          text unique default encode(gen_random_bytes(16), 'hex'),
  plan                  text not null default 'free',  -- free | pro | agency
  created_at            timestamptz default now(),
  clickup_enabled       boolean default false,
  clickup_api_token     text,
  clickup_workspace_id  text,
  clickup_space_id      text,
  clickup_folder_id     text,
  clickup_list_id       text,
  clickup_assignee_id   text,
  clickup_auto_sync     boolean default false
);

-- ─── COMMENTS ──────────────────────────────────────────────────────────────
create table if not exists comments (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid references projects(id) on delete cascade not null,
  client_name          text not null,
  client_email         text not null,
  body                 text not null,
  x_percent            float not null,
  y_percent            float not null,
  page_path            text not null default '/',
  status               text not null default 'open',   -- open | resolved
  resolved_at          timestamptz,
  browser              text,
  viewport_w           integer,
  created_at           timestamptz default now(),
  clickup_task_id      text,
  clickup_task_url     text,
  clickup_synced       boolean default false
);

-- ─── REPLIES ───────────────────────────────────────────────────────────────
create table if not exists replies (
  id          uuid primary key default gen_random_uuid(),
  comment_id  uuid references comments(id) on delete cascade not null,
  author      text not null,   -- "Agency" or client name
  body        text not null,
  created_at  timestamptz default now()
);

-- ─── LOGIN SESSIONS (OAUTH) ───────────────────────────────────────────────
create table if not exists login_sessions (
  id uuid primary key,
  access_token text not null,
  refresh_token text not null,
  created_at timestamptz default now()
);

-- ─── ROW LEVEL SECURITY ────────────────────────────────────────────────────
alter table projects enable row level security;
alter table comments enable row level security;
alter table replies  enable row level security;
alter table login_sessions enable row level security;

-- Projects: only the owning agency user can see/edit theirs
create policy "Agency owns their projects"
  on projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Comments: anon clients can INSERT (via client script with anon key)
create policy "Anon can insert comments"
  on comments for insert
  with check (true);

-- Comments: only the project owner can SELECT/UPDATE
create policy "Agency reads own project comments"
  on comments for select
  using (
    project_id in (select id from projects where user_id = auth.uid())
  );

create policy "Agency updates own project comments"
  on comments for update
  using (
    project_id in (select id from projects where user_id = auth.uid())
  );

create policy "Agency deletes own project comments"
  on comments for delete
  using (
    project_id in (select id from projects where user_id = auth.uid())
  );

-- Replies: anyone can insert (client replies via future feature), owner reads
create policy "Anyone can insert replies"
  on replies for insert
  with check (true);

create policy "Anyone can read replies"
  on replies for select
  using (true);

-- Login sessions: anyone can do anything (for OAuth flow)
create policy "Anyone can insert login sessions"
  on login_sessions for insert
  with check (true);

create policy "Anyone can read login sessions"
  on login_sessions for select
  using (true);

create policy "Anyone can delete login sessions"
  on login_sessions for delete
  using (true);

-- ─── REALTIME ──────────────────────────────────────────────────────────────
-- Enable live dashboard updates in the plugin
alter publication supabase_realtime add table comments;
alter publication supabase_realtime add table replies;

-- ─── INDEXES ───────────────────────────────────────────────────────────────
create index if not exists idx_comments_project_id on comments(project_id);
create index if not exists idx_comments_status     on comments(status);
create index if not exists idx_replies_comment_id  on replies(comment_id);
create index if not exists idx_projects_user_id    on projects(user_id);
create index if not exists idx_projects_token      on projects(invite_token);