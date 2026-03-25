-- Supabase database schema
-- This file defines the tables for indexes for the SQL execution in the Inngest background jobs

-- ============================================
-- Extensions
-- ============================================
create extension if not exists postgis cascade;
create extension if not exists vector cascade;

-- ============================================
-- Sessions table
-- ============================================
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  client_name text,
  client_company text,
  meeting_title text,
  meeting_type text default 'initial_hearing',
  meeting_date timestamptz,
  status text default 'scheduled',
  notes text,
  consent_confirmed boolean default false,
  created_by text,
  started_at timestamptz,
  ended_at timestamptz
);

create index idx_sessions_created on sessions(created_at);
create index idx_sessions_status on sessions(status);

-- ============================================
-- Transcript segments table
-- ============================================
create table if not exists transcript_segments (
  id text primary key,
  session_id uuid references sessions(id) on delete cascade,
  ts_start decimal,
  ts_end decimal,
  text text not null,
  is_final boolean default false,
  speaker integer,
  confidence decimal,
  source text default 'browser',
  created_at timestamptz default now()
);

create index idx_transcript_session on transcript_segments(session_id, ts_start);
create index idx_transcript_created on transcript_segments(created_at);

-- ============================================
-- Insights table
-- ============================================
create table if not exists insights (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  summary_text text,
  pain_points jsonb,
  constraints jsonb,
  stakeholders jsonb,
  timeline jsonb,
  sentiment text,
  budget_hint text,
  competitors text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_insight_session on insights(session_id);
create index idx_insight_created on insights(created_at);

-- ============================================
-- Suggestions table
-- ============================================
create table if not exists suggestions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  questions jsonb,
  proposals jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_suggestion_session on suggestions(session_id);
create index idx_suggestion_created on suggestions(created_at);

-- ============================================
-- Rolling summaries table
-- ============================================
create table if not exists rolling_summaries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  summary_text text,
  key_topics text[],
  created_at timestamptz default now()
);

create index idx_rolling_summary_session on rolling_summaries(session_id);
create index idx_rolling_summary_created on rolling_summaries(created_at);

-- ============================================
-- Next actions table
-- ============================================
create table if not exists next_actions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  action text,
  owner text,
  deadline date,
  priority text,
  completed boolean default false,
  created_at timestamptz default now()
);

create index idx_next_action_session on next_actions(session_id);
create index idx_next_action_created on next_actions(created_at);

-- ============================================
-- Case snippets table
-- ============================================
create table if not exists case_snippets (
  id text primary key,
  session_id uuid references sessions(id) on delete cascade,
  title text,
  industry text,
  pain_tags text[],
  snippet_text text,
  embedding extensions.vector,
  similarity float,
  created_at timestamptz default now()
);

create index idx_case_snippet_session on case_snippets(session_id);
create index idx_case_snippet_created on case_snippets(created_at);

-- ============================================
-- Feedback events table
-- ============================================
create table if not exists feedback_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  target_type text,
  target_id text,
  vote integer,
  created_at timestamptz default now()
);

create index idx_feedback_event_session on feedback_events(session_id, target_type);

-- ============================================
-- Session summary history
-- ============================================
create table if not exists session_summary_history (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  summary_json jsonb,
  created_at timestamptz default now()
);

create index idx_session_summary_session on session_summary_history(session_id);
create index idx_session_summary_created on session_summary_history(created_at);

-- ============================================
-- RLS Policies (Row Level Security)
-- ============================================
alter table sessions enable row level security;
alter table transcript_segments enable row level security;
alter table insights enable row level security;
alter table suggestions enable row level security;
alter table rolling_summaries enable row level security;
alter table next_actions enable row level security;
alter table case_snippets enable row level security;
alter table feedback_events enable row level security;
alter table session_summary_history enable row level security;

-- Allow all operations for authenticated users (adjust as needed)
create policy "Allow all for anon" on sessions for all using (true);
create policy "Allow all for anon" on transcript_segments for all using (true);
create policy "Allow all for anon" on insights for all using (true);
create policy "Allow all for anon" on suggestions for all using (true);
create policy "Allow all for anon" on rolling_summaries for all using (true);
create policy "Allow all for anon" on next_actions for all using (true);
create policy "Allow all for anon" on case_snippets for all using (true);
create policy "Allow all for anon" on feedback_events for all using (true);
create policy "Allow all for anon" on session_summary_history for all using (true);
