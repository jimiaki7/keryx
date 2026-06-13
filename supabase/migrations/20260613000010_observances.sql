-- KX-024: observances（教会暦・行事）。series とは別概念（連続講解の計画ではなく、
-- アドベント/イースター等の暦上の出来事）。Workspace ごとに有効化（プリセット適用）・
-- 名称変更・独自追加・削除（ソフト）できる。書き込みは礼拝計画系と同じ owner/pastor/planner。

create table public.observances (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  kind text not null default 'custom',
  starts_on date not null,
  ends_on date not null,
  color text not null default '',
  source text not null default 'workspace' check (source in ('preset', 'workspace')),
  -- プリセット再適用の冪等キー（例 'easter-2026'）。独自追加は null。
  preset_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  version integer not null default 1,
  check (ends_on >= starts_on)
);

-- preset_key は workspace 内で一意（再適用で二重作成しない）。custom は null（NULL は一意で衝突しない）。
-- ソフトデリート済みの preset 行もキーを保持する＝ユーザーが消した暦は再適用で復活しない。
create unique index observances_preset_key_idx
  on public.observances (workspace_id, preset_key);

create index observances_workspace_dates_idx
  on public.observances (workspace_id, starts_on)
  where deleted_at is null;

create trigger observances_before_insert
  before insert on public.observances
  for each row execute function public.row_before_insert_actor();
create trigger observances_before_update
  before update on public.observances
  for each row execute function public.row_before_update();
create trigger observances_audit
  after insert or update on public.observances
  for each row execute function public.audit_row_changes('observance');

alter table public.observances enable row level security;
revoke all on public.observances from anon;
-- ハード DELETE は許可しない（ソフトデリートのみ。venues / gatherings と同方針）
grant select, insert, update on public.observances to authenticated;
grant all on public.observances to service_role;

create policy observances_select_member on public.observances
  for select using (public.is_active_member(workspace_id));
create policy observances_insert_planner on public.observances
  for insert with check (public.member_role(workspace_id) in ('owner', 'pastor', 'planner'));
create policy observances_update_planner on public.observances
  for update using (public.member_role(workspace_id) in ('owner', 'pastor', 'planner'))
  with check (public.member_role(workspace_id) in ('owner', 'pastor', 'planner'));
