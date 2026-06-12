-- KX-013: service_elements（並べ替え可能な礼拝順序。固定列は作らない）
-- 賛美・式典は複数登録でき、式典の前後にも賛美を自由に配置できる（position で順序管理）。
-- 式典タイプは metadata.ceremony_type に保持する（聖餐式・洗礼式・転入会式・任職式・召天者記念・その他）。

create table public.service_elements (
  id uuid primary key default gen_random_uuid(),
  gathering_id uuid not null references public.gatherings (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  position numeric not null default 1
    check (position > 0 and position < 'Infinity'::numeric),
  type text not null default 'custom'
    check (type in (
      'call_to_worship', 'hymn', 'prayer', 'responsive_reading', 'scripture_reading',
      'message', 'offering', 'ceremony', 'doxology', 'benediction', 'custom'
    )),
  title text not null default '',
  content text not null default '',
  reference text not null default '',
  assignee text not null default '',
  duration_minutes smallint check (duration_minutes is null or duration_minutes between 0 and 600),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index service_elements_gathering_idx
  on public.service_elements (gathering_id, position);

create trigger service_elements_set_updated_at
  before update on public.service_elements
  for each row execute function public.set_updated_at();

alter table public.service_elements enable row level security;
revoke all on public.service_elements from anon;
grant select, insert, update, delete on public.service_elements to authenticated;
grant all on public.service_elements to service_role;

-- exists 句は必ず service_elements.workspace_id と明示修飾する（非修飾はトートロジー化する）
create policy service_elements_select_member on public.service_elements
  for select using (public.is_active_member(workspace_id));
create policy service_elements_insert_planner on public.service_elements
  for insert with check (
    public.member_role(workspace_id) in ('owner', 'pastor', 'planner')
    and exists (
      select 1 from public.gatherings g
      where g.id = gathering_id
        and g.workspace_id = service_elements.workspace_id
        and g.deleted_at is null
    )
  );
create policy service_elements_update_planner on public.service_elements
  for update using (public.member_role(workspace_id) in ('owner', 'pastor', 'planner'))
  with check (
    public.member_role(workspace_id) in ('owner', 'pastor', 'planner')
    and exists (
      select 1 from public.gatherings g
      where g.id = gathering_id
        and g.workspace_id = service_elements.workspace_id
        and g.deleted_at is null
    )
  );
create policy service_elements_delete_planner on public.service_elements
  for delete using (public.member_role(workspace_id) in ('owner', 'pastor', 'planner'));
