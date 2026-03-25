-- Fix RLS policies to allow all operations for anon users
-- This migration fixes the missing WITH CHECK clause that was preventing INSERT operations

-- Drop existing policies
drop policy if exists "Allow all for anon" on sessions;
drop policy if exists "Allow all for anon" on transcript_segments;
drop policy if exists "Allow all for anon" on insights;
drop policy if exists "Allow all for anon" on suggestions;
drop policy if exists "Allow all for anon" on rolling_summaries;
drop policy if exists "Allow all for anon" on next_actions;
drop policy if exists "Allow all for anon" on case_snippets;
drop policy if exists "Allow all for anon" on feedback_events;
drop policy if exists "Allow all for anon" on session_summary_history;

-- Create proper policies with both USING and WITH CHECK clauses
create policy "Allow all for anon" on sessions
  for all
  using (true)
  with check (true);

create policy "Allow all for anon" on transcript_segments
  for all
  using (true)
  with check (true);

create policy "Allow all for anon" on insights
  for all
  using (true)
  with check (true);

create policy "Allow all for anon" on suggestions
  for all
  using (true)
  with check (true);

create policy "Allow all for anon" on rolling_summaries
  for all
  using (true)
  with check (true);

create policy "Allow all for anon" on next_actions
  for all
  using (true)
  with check (true);

create policy "Allow all for anon" on case_snippets
  for all
  using (true)
  with check (true);

create policy "Allow all for anon" on feedback_events
  for all
  using (true)
  with check (true);

create policy "Allow all for anon" on session_summary_history
  for all
  using (true)
  with check (true);
