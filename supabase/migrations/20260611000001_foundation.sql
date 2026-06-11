-- KX-002 / KX-003: Workspace・membership・profile の基盤と RLS
-- 公開スキーマの全テーブルで RLS を必須とする（docs/product/TECHNICAL_ARCHITECTURE.md §6）

-- ---------------------------------------------------------------------------
-- 共通: updated_at 自動更新
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- workspaces
-- ---------------------------------------------------------------------------
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique
    constraint workspaces_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  timezone text not null default 'Asia/Tokyo',
  locale text not null default 'ja',
  denomination_preset text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid,
  deleted_at timestamptz,
  version integer not null default 1
);

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- workspace_members
-- ---------------------------------------------------------------------------
create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'pastor', 'planner', 'viewer')),
  status text not null default 'active' check (status in ('active', 'invited', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index workspace_members_user_id_idx on public.workspace_members (user_id);

create trigger workspace_members_set_updated_at
  before update on public.workspace_members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- membership ヘルパー（security definer で RLS の自己再帰を回避）
-- ---------------------------------------------------------------------------
create function public.is_active_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = target_workspace
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create function public.member_role(target_workspace uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.workspace_members m
  where m.workspace_id = target_workspace
    and m.user_id = (select auth.uid())
    and m.status = 'active'
  limit 1;
$$;

revoke execute on function public.is_active_member(uuid) from public, anon;
revoke execute on function public.member_role(uuid) from public, anon;
grant execute on function public.is_active_member(uuid) to authenticated;
grant execute on function public.member_role(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

-- テーブル権限は暗黙のデフォルト権限に頼らず明示する。
-- 行レベルの制御は RLS policy が担う。匿名ロールには一切与えない（多層防御）。
revoke all on public.profiles, public.workspaces, public.workspace_members from anon;
grant select, insert, update, delete
  on public.profiles, public.workspaces, public.workspace_members
  to authenticated;
grant all on public.profiles, public.workspaces, public.workspace_members to service_role;

-- profiles: 本人のみ
create policy profiles_select_own on public.profiles
  for select using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- workspaces: active member のみ閲覧、owner のみ更新。
-- insert ポリシーは定義しない（作成は create_workspace RPC 経由のみ）。
create policy workspaces_select_member on public.workspaces
  for select using (public.is_active_member(id));
create policy workspaces_update_owner on public.workspaces
  for update using (public.member_role(id) = 'owner')
  with check (public.member_role(id) = 'owner');

-- workspace_members: active member が閲覧、owner が管理
create policy members_select_member on public.workspace_members
  for select using (public.is_active_member(workspace_id));
create policy members_insert_owner on public.workspace_members
  for insert with check (public.member_role(workspace_id) = 'owner');
create policy members_update_owner on public.workspace_members
  for update using (public.member_role(workspace_id) = 'owner')
  with check (public.member_role(workspace_id) = 'owner');
create policy members_delete_owner on public.workspace_members
  for delete using (public.member_role(workspace_id) = 'owner');

-- ---------------------------------------------------------------------------
-- Workspace 作成 RPC（workspace + owner membership を原子的に作成）
-- ---------------------------------------------------------------------------
create function public.create_workspace(workspace_name text, workspace_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'authentication required';
  end if;
  if workspace_name is null or length(trim(workspace_name)) = 0 then
    raise exception 'workspace name is required';
  end if;
  if workspace_slug is null or workspace_slug !~ '^[a-z0-9][a-z0-9-]{1,62}$' then
    raise exception 'invalid workspace slug';
  end if;

  insert into public.workspaces (name, slug, created_by, updated_by)
  values (trim(workspace_name), workspace_slug, uid, uid)
  returning id into new_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_id, uid, 'owner');

  return new_id;
end;
$$;

revoke execute on function public.create_workspace(text, text) from public, anon;
grant execute on function public.create_workspace(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 新規ユーザーの profile 自動作成
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'name', ''), 120));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
