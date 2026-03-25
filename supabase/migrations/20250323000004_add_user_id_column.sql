-- sessionsテーブルにuser_idカラムを追加
alter table sessions add column if not exists user_id text;

-- 既存データのcreated_byをuser_idに移行（nullの場合は空文字）
update sessions
set user_id = coalesce(created_by, '')
where user_id is null;

-- user_idにnot null制約を追加
alter table sessions alter column user_id set not null;

-- user_idにインデックスを追加
create index if not exists idx_sessions_user_id on sessions(user_id);
