-- ユーザー分離: 各ユーザーが自分のデータのみアクセス可能にする

-- 既存の全てのポリシーを削除（名前が異なる可能性があるため）
drop policy if exists "Users can view their own sessions" on sessions;
drop policy if exists "Users can insert their own sessions" on sessions;
drop policy if exists "Users can update their own sessions" on sessions;
drop policy if exists "Users can view own sessions" on sessions;
drop policy if exists "Users can insert own sessions" on sessions;
drop policy if exists "Users can update own sessions" on sessions;

drop policy if exists "Users can view their own insights" on insights;
drop policy if exists "Users can insert their own insights" on insights;
drop policy if exists "Users can update their own insights" on insights;
drop policy if exists "Users can view own insights" on insights;
drop policy if exists "Users can insert own insights" on insights;
drop policy if exists "Users can update own insights" on insights;

drop policy if exists "Users can view their own transcript segments" on transcript_segments;
drop policy if exists "Users can insert their own transcript segments" on transcript_segments;
drop policy if exists "Users can view own transcript segments" on transcript_segments;
drop policy if exists "Users can insert own transcript segments" on transcript_segments;

-- セッションテーブル: auth.uid()でユーザーを識別
create policy "Users can view own sessions" on sessions
  for select
  to authenticated
  using (auth.uid()::text = user_id);

create policy "Users can insert own sessions" on sessions
  for insert
  to authenticated
  with check (auth.uid()::text = user_id);

create policy "Users can update own sessions" on sessions
  for update
  to authenticated
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- インサイトテーブル: セッションを通じてユーザーを識別
create policy "Users can view own insights" on insights
  for select
  to authenticated
  using (
    exists (
      select 1 from sessions
      where sessions.id = insights.session_id
      and sessions.user_id = auth.uid()::text
    )
  );

create policy "Users can insert own insights" on insights
  for insert
  to authenticated
  with check (
    exists (
      select 1 from sessions
      where sessions.id = insights.session_id
      and sessions.user_id = auth.uid()::text
    )
  );

create policy "Users can update own insights" on insights
  for update
  to authenticated
  using (
    exists (
      select 1 from sessions
      where sessions.id = insights.session_id
      and sessions.user_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1 from sessions
      where sessions.id = insights.session_id
      and sessions.user_id = auth.uid()::text
    )
  );

-- 文字起こしセグメント: セッションを通じてユーザーを識別
create policy "Users can view own transcript segments" on transcript_segments
  for select
  to authenticated
  using (
    exists (
      select 1 from sessions
      where sessions.id = transcript_segments.session_id
      and sessions.user_id = auth.uid()::text
    )
  );

create policy "Users can insert own transcript segments" on transcript_segments
  for insert
  to authenticated
  with check (
    exists (
      select 1 from sessions
      where sessions.id = transcript_segments.session_id
      and sessions.user_id = auth.uid()::text
    )
  );
