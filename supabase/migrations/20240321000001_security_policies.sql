-- セキュリティ改善: RLSポリシーの更新
-- 本番環境向けの厳格なポリシー

-- 既存の緩いポリシーを削除
drop policy if exists "Allow all for anon" on sessions;
drop policy if exists "Allow all for anon" on transcript_segments;
drop policy if exists "Allow all for anon" on insights;
drop policy if exists "Allow all for anon" on suggestions;
drop policy if exists "Allow all for anon" on rolling_summaries;
drop policy if exists "Allow all for anon" on next_actions;
drop policy if exists "Allow all for anon" on case_snippets;
drop policy if exists "Allow all for anon" on feedback_events;
drop policy if exists "Allow all for anon" on session_summary_history;

-- ============================================
-- 本番環境用の厳格なRLSポリシー
-- ============================================

-- Sessions: 認証済みユーザーは自分のセッションのみアクセス可能
create policy "Users can view own sessions"
on sessions for select
using (auth.uid()::text = created_by::text);

create policy "Users can insert own sessions"
on sessions for insert
with check (auth.uid()::text = created_by::text);

create policy "Users can update own sessions"
on sessions for update
using (auth.uid()::text = created_by::text);

create policy "Users can delete own sessions"
on sessions for delete
using (auth.uid()::text = created_by::text);

-- Transcript segments: セッション所有者のみアクセス可能
create policy "Users can view transcript of own sessions"
on transcript_segments for select
using (
  exists (
    select 1 from sessions
    where sessions.id = transcript_segments.session_id
    and sessions.created_by::text = auth.uid()::text
  )
);

create policy "Users can insert transcript to own sessions"
on transcript_segments for insert
with check (
  exists (
    select 1 from sessions
    where sessions.id = transcript_segments.session_id
    and sessions.created_by::text = auth.uid()::text
  )
);

-- Insights: セッション所有者のみアクセス可能
create policy "Users can view insight of own sessions"
on insights for select
using (
  exists (
    select 1 from sessions
    where sessions.id = insights.session_id
    and sessions.created_by::text = auth.uid()::text
  )
);

-- Suggestions: セッション所有者のみアクセス可能
create policy "Users can view suggestions of own sessions"
on suggestions for select
using (
  exists (
    select 1 from sessions
    where sessions.id = suggestions.session_id
    and sessions.created_by::text = auth.uid()::text
  )
);

-- Rolling summaries: セッション所有者のみアクセス可能
create policy "Users can view summaries of own sessions"
on rolling_summaries for select
using (
  exists (
    select 1 from sessions
    where sessions.id = rolling_summaries.session_id
    and sessions.created_by::text = auth.uid()::text
  )
);

-- Next actions: セッション所有者のみアクセス可能
create policy "Users can view actions of own sessions"
on next_actions for select
using (
  exists (
    select 1 from sessions
    where sessions.id = next_actions.session_id
    and sessions.created_by::text = auth.uid()::text
  )
);

create policy "Users can insert actions to own sessions"
on next_actions for insert
with check (
  exists (
    select 1 from sessions
    where sessions.id = next_actions.session_id
    and sessions.created_by::text = auth.uid()::text
  )
);

create policy "Users can update actions of own sessions"
on next_actions for update
using (
  exists (
    select 1 from sessions
    where sessions.id = next_actions.session_id
    and sessions.created_by::text = auth.uid()::text
  )
);

-- Case snippets: セッション所有者のみアクセス可能
create policy "Users can view snippets of own sessions"
on case_snippets for select
using (
  exists (
    select 1 from sessions
    where sessions.id = case_snippets.session_id
    and sessions.created_by::text = auth.uid()::text
  )
);

-- Feedback events: セッション所有者のみアクセス可能
create policy "Users can view feedback of own sessions"
on feedback_events for select
using (
  exists (
    select 1 from sessions
    where sessions.id = feedback_events.session_id
    and sessions.created_by::text = auth.uid()::text
  )
);

create policy "Users can insert feedback to own sessions"
on feedback_events for insert
with check (
  exists (
    select 1 from sessions
    where sessions.id = feedback_events.session_id
    and sessions.created_by::text = auth.uid()::text
  )
);

-- Session summary history: セッション所有者のみアクセス可能
create policy "Users can view history of own sessions"
on session_summary_history for select
using (
  exists (
    select 1 from sessions
    where sessions.id = session_summary_history.session_id
    and sessions.created_by::text = auth.uid()::text
  )
);

-- ============================================
-- 開発環境用の緩いポリシー（環境変数で制御）
-- ============================================

-- 注: 本番環境では以下のポリシーは適用しないでください
-- 開発環境でのみ、認証なしでのアクセスを許可

-- 開発環境用: 全ての操作を許可（慎重に使用）
do $$
begin
  -- 開発環境の場合のみ緩いポリシーを作成
  if current_setting('app.development', true) = 'true' then
    create policy "Dev: Allow all for anon" on sessions for all using (true);
    create policy "Dev: Allow all for anon" on transcript_segments for all using (true);
    create policy "Dev: Allow all for anon" on insights for all using (true);
    create policy "Dev: Allow all for anon" on suggestions for all using (true);
    create policy "Dev: Allow all for anon" on rolling_summaries for all using (true);
    create policy "Dev: Allow all for anon" on next_actions for all using (true);
    create policy "Dev: Allow all for anon" on case_snippets for all using (true);
    create policy "Dev: Allow all for anon" on feedback_events for all using (true);
    create policy "Dev: Allow all for anon" on session_summary_history for all using (true);
  end if;
end $$;
