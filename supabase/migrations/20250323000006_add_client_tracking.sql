-- ============================================
-- Add client tracking for conversation history
-- ============================================

-- ============================================
-- Clients table
-- ============================================
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid(),  -- 所有者
  name text not null,
  company text,
  industry text,
  company_size text,  -- small, medium, large, enterprise
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- クライアント検索用のインデックス
create index idx_clients_user_id on clients(user_id);
create index idx_clients_company on clients(company);
create index idx_clients_industry on clients(industry);
create index idx_clients_created on clients(created_at);

-- ============================================
-- Add client_id to sessions table
-- ============================================
alter table sessions
  add column if not exists client_id uuid references clients(id) on delete set null;

-- 既存データの移行（オプション：client_name + client_companyの組み合わせでクライアントを作成）
-- これは既存データをクライアントテーブルに移行するためのもの
-- do $$
-- declare
--   session record;
--   client_id uuid;
-- begin
--   for session in
--     select distinct id, client_name, client_company, created_by
--     from sessions
--     where client_name is not null
--       and client_id is null
--     limit 100  -- 一度に処理する数を制限
--   loop
--     -- クライアントを作成または取得
--     insert into clients (name, company, created_by)
--     values (session.client_name, session.client_company, session.created_by)
--     on conflict (name, company) do nothing
--     returning id into client_id;

--     if client_id is null then
--       select id into client_id from clients where name = session.client_name and company = session.client_company;
--     end if;

--     -- セッションに紐付け
--     update sessions set client_id = client_id where id = session.id;
--   end loop;
-- end $$;

-- インデックス作成
create index idx_sessions_client_id on sessions(client_id);
create index idx_sessions_user_client on sessions(user_id, client_id);

-- ============================================
-- Client insights aggregation table
-- ============================================
-- クライアント全体のインサイト集約用
create table if not exists client_insights (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,

  -- 集約されたインサイト
  pain_points jsonb,           -- クライアント全体の課題
  constraints jsonb,           -- クライアント全体の制約
  stakeholders jsonb,          -- ステークホルダーの変遷
  evolution jsonb,             -- 時系列での変化

  -- メタデータ
  is_latest boolean default false,  -- 最新の集約かどうか
  session_count integer default 1,  -- 集約に含まれるセッション数

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_client_insights_client_id on client_insights(client_id);
create index idx_client_insights_session_id on client_insights(session_id);
create index idx_client_insights_latest on client_insights(client_id, is_latest);

-- ============================================
-- RLS Policies for clients
-- ============================================
alter table clients enable row level security;
alter table client_insights enable row level security;

-- ユーザーは自分のクライアントのみアクセス可能
create policy "Users can view their own clients"
  on clients for select
  using (auth.uid() = user_id);

create policy "Users can insert their own clients"
  on clients for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own clients"
  on clients for update
  using (auth.uid() = user_id);

create policy "Users can delete their own clients"
  on clients for delete
  using (auth.uid() = user_id);

-- client_insightsへのポリシー（クライアント所有者 through clients table）
create policy "Users can view insights for their clients"
  on client_insights for select
  using (
    exists (
      select 1 from clients
      where clients.id = client_insights.client_id
        and clients.user_id = auth.uid()
    )
  );

create policy "Users can insert insights for their clients"
  on client_insights for insert
  with check (
    exists (
      select 1 from clients
      where clients.id = client_insights.client_id
        and clients.user_id = auth.uid()
    )
  );

-- ============================================
-- Functions for automatic client insights aggregation
-- ============================================

-- セッションが完了したときにクライアントインサイトを更新する関数
create or replace function update_client_insights_on_session_complete()
returns trigger as $$
declare
  v_client_id uuid;
  v_session_count integer;
begin
  -- セッションのクライアントIDを取得
  select client_id into v_client_id
  from sessions
  where id = new.session_id;

  if v_client_id is null then
    return new;
  end if;

  -- 以前の最新フラグをオフにする
  update client_insights
  set is_latest = false
  where client_id = v_client_id and is_latest = true;

  -- セッション数をカウント
  select count(*) into v_session_count
  from sessions
  where client_id = v_client_id;

  -- 新しいクライアントインサイトを作成
  insert into client_insights (
    client_id,
    session_id,
    pain_points,
    constraints,
    stakeholders,
    evolution,
    is_latest,
    session_count
  )
  select
    v_client_id,
    new.session_id,
    new.pain_points,
    new.constraints,
    new.stakeholders,
    jsonb_build_object(
      'session_date', (select created_at from sessions where id = new.session_id),
      'session_count', v_session_count
    ),
    true,
    v_session_count
  from insights
  where session_id = new.session_id;

  return new;
end;
$$ language plpgsql;

-- トリガーはinsightsのinsert時に発火
-- drop trigger if exists trigger_update_client_insights on insights;
-- create trigger trigger_update_client_insights
--   after insert on insights
--   for each row
--   execute function update_client_insights_on_session_complete();

-- ============================================
-- Helper function to get client conversation history
-- ============================================
create or replace function get_client_conversation_history(p_client_id uuid)
returns table (
  session_id uuid,
  session_date timestamptz,
  summary_text text,
  pain_points jsonb,
  constraints jsonb,
  stakeholders jsonb,
  sentiment text
) as $$
begin
  return query
  select
    s.id as session_id,
    s.created_at as session_date,
    i.summary_text,
    i.pain_points,
    i.constraints,
    i.stakeholders,
    i.sentiment
  from sessions s
  left join insights i on i.session_id = s.id
  where s.client_id = p_client_id
  order by s.created_at desc
  limit 10;
end;
$$ language plpgsql security definer;

-- ============================================
-- Comments for documentation
-- ============================================
comment on table clients is 'クライアント情報を管理するテーブル';
comment on table client_insights is 'クライアント全体のインサイトを集約したテーブル';
comment on column sessions.client_id is '関連するクライアントの外部キー';
comment on function get_client_conversation_history is 'クライアントの会話履歴を取得する関数';
