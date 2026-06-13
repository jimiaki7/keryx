-- KX-022: メッセージ検索（search_messages RPC）と保存フィルター（saved_filters）
--
-- 検索は会場・説教者・日付が gatherings / message_deliveries 側にあり、PostgREST の
-- 単純クエリでは「自由文の OR」と「関連テーブルの AND 絞り込み」を綺麗に両立できないため、
-- SECURITY INVOKER の SQL 関数にまとめる（RLS が workspace 分離を強制し、pgTAP で検証可能）。

-- 大文字小文字を無視した部分一致（ILIKE のワイルドカード注入を避けるため position を使う）
create function public.ilike_contains(haystack text, needle text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select haystack is not null and position(lower(needle) in lower(haystack)) > 0;
$$;

-- ---------------------------------------------------------------------------
-- search_messages: メッセージを横断検索する（一覧表示に必要な形で返す）
--   p_text   : タイトル / 中心メッセージ / 主題(legacy) / 聖書箇所表示 の自由文一致
--   p_series : primary_series_id 完全一致
--   p_venue  : 関連 Gathering の会場名 部分一致
--   p_speaker: 関連 Delivery の説教者名 部分一致
--   p_status / p_type : 完全一致
--   p_date_from / p_date_to : 関連 Gathering の開始日（Asia/Tokyo の暦日）範囲
-- ---------------------------------------------------------------------------
create function public.search_messages(
  p_workspace uuid,
  p_text text default null,
  p_series uuid default null,
  p_venue text default null,
  p_speaker text default null,
  p_status text default null,
  p_type text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  id uuid,
  display_id text,
  type text,
  status text,
  preparation_stage text,
  title text,
  created_at timestamptz,
  passages jsonb,
  total_count bigint
)
language sql
stable
set search_path = ''
as $$
  select
    m.id, m.display_id, m.type, m.status, m.preparation_stage, m.title, m.created_at,
    coalesce(
      (select jsonb_agg(jsonb_build_object('display_text', mp.display_text, 'role', mp.role)
                order by mp.position)
       from public.message_passages mp
       where mp.message_id = m.id),
      '[]'::jsonb
    ) as passages,
    -- 一致総数（LIMIT 前の全件。max_rows での無言切り詰めを避け、正確な件数表示に使う）
    count(*) over () as total_count
  from public.messages m
  where m.workspace_id = p_workspace
    and m.deleted_at is null
    and (p_status is null or m.status = p_status)
    and (p_type is null or m.type = p_type)
    and (p_series is null or m.primary_series_id = p_series)
    and (
      p_text is null
      or public.ilike_contains(m.title, p_text)
      or public.ilike_contains(m.central_message, p_text)
      or public.ilike_contains(m.metadata -> 'legacy' ->> 'theme', p_text)
      or exists (
        select 1 from public.message_passages mp
        where mp.message_id = m.id and public.ilike_contains(mp.display_text, p_text)
      )
    )
    and (
      p_venue is null
      or exists (
        select 1
        from public.message_deliveries d
        join public.gatherings g on g.id = d.gathering_id and g.deleted_at is null
        join public.venues v on v.id = g.venue_id
        where d.message_id = m.id and public.ilike_contains(v.name, p_venue)
      )
    )
    and (
      p_speaker is null
      or exists (
        select 1 from public.message_deliveries d
        where d.message_id = m.id and public.ilike_contains(d.speaker_name, p_speaker)
      )
    )
    and (
      -- from/to は同一 delivery が範囲内にあることを要求する（別々の delivery が両端を
      -- 満たす誤一致や、逆転範囲での誤ヒットを防ぐため、単一の EXISTS にまとめる）
      (p_date_from is null and p_date_to is null)
      or exists (
        select 1
        from public.message_deliveries d
        join public.gatherings g on g.id = d.gathering_id and g.deleted_at is null
        where d.message_id = m.id
          and (p_date_from is null or (g.starts_at at time zone 'Asia/Tokyo')::date >= p_date_from)
          and (p_date_to is null or (g.starts_at at time zone 'Asia/Tokyo')::date <= p_date_to)
      )
    )
  order by m.updated_at desc, m.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke execute on function
  public.search_messages(uuid, text, uuid, text, text, text, text, date, date, int, int)
  from public, anon;
grant execute on function
  public.search_messages(uuid, text, uuid, text, text, text, text, date, date, int, int)
  to authenticated;

-- ---------------------------------------------------------------------------
-- saved_filters: ユーザーごとの保存済み検索条件（workspace 内）
-- ---------------------------------------------------------------------------
create table public.saved_filters (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  -- params は小さな検索条件オブジェクトに限定する（PostgREST 直叩きでの肥大化を DB 境界で防ぐ）
  params jsonb not null default '{}'::jsonb
    check (jsonb_typeof(params) = 'object' and pg_column_size(params) < 4096),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, name)
);

create index saved_filters_owner_idx on public.saved_filters (workspace_id, user_id);

create trigger saved_filters_set_updated_at
  before update on public.saved_filters
  for each row execute function public.set_updated_at();

alter table public.saved_filters enable row level security;
revoke all on public.saved_filters from anon;
grant select, insert, update, delete on public.saved_filters to authenticated;
grant all on public.saved_filters to service_role;

-- 本人かつ active member の行のみ操作できる
create policy saved_filters_select_own on public.saved_filters
  for select using (user_id = (select auth.uid()) and public.is_active_member(workspace_id));
create policy saved_filters_insert_own on public.saved_filters
  for insert with check (user_id = (select auth.uid()) and public.is_active_member(workspace_id));
create policy saved_filters_update_own on public.saved_filters
  for update using (user_id = (select auth.uid()) and public.is_active_member(workspace_id))
  with check (user_id = (select auth.uid()) and public.is_active_member(workspace_id));
create policy saved_filters_delete_own on public.saved_filters
  for delete using (user_id = (select auth.uid()) and public.is_active_member(workspace_id));
