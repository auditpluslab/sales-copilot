-- セキュリティ強化: 認証済みユーザーのみアクセス可能にする

-- 既存の緩いポリシーを削除
drop policy if exists "Allow all for anon" on sessions;
drop policy if exists "Allow all for anon" on insights;
drop policy if exists "Allow all for anon" on transcript_segments;

-- セッションテーブルの認証ポリシー
create policy "Users can view their own sessions" on sessions
  for select
  to authenticated
  using (true);

create policy "Users can insert their own sessions" on sessions
  for insert
  to authenticated
  with check (true);

create policy "Users can update their own sessions" on sessions
  for update
  to authenticated
  using (true)
  with check (true);

-- インサイトテーブルの認証ポリシー
create policy "Users can view their own insights" on insights
  for select
  to authenticated
  using (true);

create policy "Users can insert their own insights" on insights
  for insert
  to authenticated
  with check (true);

create policy "Users can update their own insights" on insights
  for update
  to authenticated
  using (true)
  with check (true);

-- 文字起こしセグメントの認証ポリシー
create policy "Users can view their own transcript segments" on transcript_segments
  for select
  to authenticated
  using (true);

create policy "Users can insert their own transcript segments" on transcript_segments
  for insert
  to authenticated
  with check (true);
