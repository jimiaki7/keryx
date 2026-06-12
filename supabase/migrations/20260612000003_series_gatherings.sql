-- KX-010: series / series_messages
-- KX-011: venues / gatherings / message_deliveries
-- 書き込みロール: series は owner/pastor、礼拝計画系（venues/gatherings/deliveries）は
-- owner/pastor/planner（TECHNICAL_ARCHITECTURE §6: Planner は Gathering と Service Element を管理）

-- ---------------------------------------------------------------------------
-- 共通: 汎用 before update（updated_at / version / updated_by）と汎用監査
-- ---------------------------------------------------------------------------
create function public.row_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  return new;
end;
$$;

create function public.row_before_insert_actor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_by := coalesce(new.created_by, (select auth.uid()));
  new.updated_by := coalesce(new.updated_by, (select auth.uid()));
  return new;
end;
$$;

-- 汎用監査トリガー。TG_ARGV[0] = entity_type。summary には name / title のみ（本文は記録しない）
create function public.audit_row_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  act text;
  changed jsonb := '[]'::jsonb;
  row_summary text;
begin
  if tg_op = 'INSERT' then
    act := 'create';
  else
    if old.deleted_at is null and new.deleted_at is not null then
      act := 'soft_delete';
    elsif old.deleted_at is not null and new.deleted_at is null then
      act := 'restore';
    else
      act := 'update';
    end if;
    select coalesce(jsonb_agg(d.key), '[]'::jsonb) into changed
    from (
      select n.key
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o on o.key = n.key
      where n.value is distinct from o.value
        and n.key not in ('updated_at', 'updated_by', 'version')
    ) d;
  end if;
  row_summary := left(coalesce(to_jsonb(new) ->> 'title', to_jsonb(new) ->> 'name', ''), 80);
  insert into public.audit_events
    (workspace_id, actor_id, entity_type, entity_id, action, summary, changed_fields)
  values
    (new.workspace_id, (select auth.uid()), tg_argv[0], new.id, act, row_summary, changed);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- series（説教シリーズ。Observance とは別概念）
-- ---------------------------------------------------------------------------
create table public.series (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  color text not null default '',
  starts_on date,
  ends_on date,
  status text not null default 'active'
    check (status in ('planned', 'active', 'paused', 'completed', 'archived')),
  primary_book_id text references public.bible_books (osis),
  goal text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  version integer not null default 1
);

create index series_workspace_idx on public.series (workspace_id) where deleted_at is null;

create trigger series_before_insert
  before insert on public.series
  for each row execute function public.row_before_insert_actor();
create trigger series_before_update
  before update on public.series
  for each row execute function public.row_before_update();
create trigger series_audit
  after insert or update on public.series
  for each row execute function public.audit_row_changes('series');

alter table public.series enable row level security;
revoke all on public.series from anon;
grant select, insert, update on public.series to authenticated;
grant all on public.series to service_role;

create policy series_select_member on public.series
  for select using (public.is_active_member(workspace_id));
create policy series_insert_writer on public.series
  for insert with check (public.member_role(workspace_id) in ('owner', 'pastor'));
create policy series_update_writer on public.series
  for update using (public.member_role(workspace_id) in ('owner', 'pastor'))
  with check (public.member_role(workspace_id) in ('owner', 'pastor'));

-- ---------------------------------------------------------------------------
-- series_messages（シリーズ内の Message と順序）
-- ---------------------------------------------------------------------------
create table public.series_messages (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.series (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  position numeric not null default 1,
  planned_passage_text text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (series_id, message_id)
);

create index series_messages_series_idx on public.series_messages (series_id);
create index series_messages_message_idx on public.series_messages (message_id);

create trigger series_messages_set_updated_at
  before update on public.series_messages
  for each row execute function public.set_updated_at();

alter table public.series_messages enable row level security;
revoke all on public.series_messages from anon;
grant select, insert, update, delete on public.series_messages to authenticated;
grant all on public.series_messages to service_role;

create policy series_messages_select_member on public.series_messages
  for select using (public.is_active_member(workspace_id));
create policy series_messages_insert_writer on public.series_messages
  for insert with check (
    public.member_role(workspace_id) in ('owner', 'pastor')
    and exists (
      select 1 from public.series s
      where s.id = series_id and s.workspace_id = series_messages.workspace_id
    )
    and exists (
      select 1 from public.messages m
      where m.id = message_id and m.workspace_id = series_messages.workspace_id
    )
  );
create policy series_messages_update_writer on public.series_messages
  for update using (public.member_role(workspace_id) in ('owner', 'pastor'))
  with check (
    public.member_role(workspace_id) in ('owner', 'pastor')
    and exists (
      select 1 from public.series s
      where s.id = series_id and s.workspace_id = series_messages.workspace_id
    )
    and exists (
      select 1 from public.messages m
      where m.id = message_id and m.workspace_id = series_messages.workspace_id
    )
  );
create policy series_messages_delete_writer on public.series_messages
  for delete using (public.member_role(workspace_id) in ('owner', 'pastor'));

-- messages.primary_series_id（主シリーズ。シリーズ削除で Message は消えない）
alter table public.messages
  add column primary_series_id uuid references public.series (id) on delete set null;

-- ---------------------------------------------------------------------------
-- venues（会場。Workspace 内で再利用する）
-- ---------------------------------------------------------------------------
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  version integer not null default 1
);

create unique index venues_workspace_name_key
  on public.venues (workspace_id, name)
  where deleted_at is null;

create trigger venues_before_insert
  before insert on public.venues
  for each row execute function public.row_before_insert_actor();
create trigger venues_before_update
  before update on public.venues
  for each row execute function public.row_before_update();

alter table public.venues enable row level security;
revoke all on public.venues from anon;
grant select, insert, update on public.venues to authenticated;
grant all on public.venues to service_role;

create policy venues_select_member on public.venues
  for select using (public.is_active_member(workspace_id));
create policy venues_insert_planner on public.venues
  for insert with check (public.member_role(workspace_id) in ('owner', 'pastor', 'planner'));
create policy venues_update_planner on public.venues
  for update using (public.member_role(workspace_id) in ('owner', 'pastor', 'planner'))
  with check (public.member_role(workspace_id) in ('owner', 'pastor', 'planner'));

-- ---------------------------------------------------------------------------
-- gatherings（実際の日時・会場・集会。Message 本文は持たない）
-- ---------------------------------------------------------------------------
create table public.gatherings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  display_id text not null default '',
  title text not null default '',
  kind text not null default 'sunday_worship'
    check (kind in ('sunday_worship', 'prayer_meeting', 'special_service', 'chapel', 'other')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null default 'Asia/Tokyo',
  venue_id uuid references public.venues (id) on delete set null,
  status text not null default 'scheduled'
    check (status in ('draft', 'scheduled', 'completed', 'canceled')),
  audience text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  version integer not null default 1,
  unique (workspace_id, display_id),
  check (ends_at is null or ends_at >= starts_at)
);

create index gatherings_workspace_starts_idx
  on public.gatherings (workspace_id, starts_at)
  where deleted_at is null;

create function public.gatherings_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.display_id is null or new.display_id = '' then
    new.display_id := public.next_display_id(new.workspace_id, 'gathering', 'GTH');
  end if;
  new.created_by := coalesce(new.created_by, (select auth.uid()));
  new.updated_by := coalesce(new.updated_by, (select auth.uid()));
  return new;
end;
$$;

create trigger gatherings_before_insert
  before insert on public.gatherings
  for each row execute function public.gatherings_before_insert();
create trigger gatherings_before_update
  before update on public.gatherings
  for each row execute function public.row_before_update();
create trigger gatherings_audit
  after insert or update on public.gatherings
  for each row execute function public.audit_row_changes('gathering');

alter table public.gatherings enable row level security;
revoke all on public.gatherings from anon;
grant select, insert, update on public.gatherings to authenticated;
grant all on public.gatherings to service_role;

create policy gatherings_select_member on public.gatherings
  for select using (public.is_active_member(workspace_id));
create policy gatherings_insert_planner on public.gatherings
  for insert with check (public.member_role(workspace_id) in ('owner', 'pastor', 'planner'));
create policy gatherings_update_planner on public.gatherings
  for update using (public.member_role(workspace_id) in ('owner', 'pastor', 'planner'))
  with check (public.member_role(workspace_id) in ('owner', 'pastor', 'planner'));

-- ---------------------------------------------------------------------------
-- message_deliveries（Message と Gathering の関連。同じ説教を複数機会で語れる）
-- ---------------------------------------------------------------------------
create table public.message_deliveries (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  gathering_id uuid not null references public.gatherings (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  speaker_member_id uuid references public.workspace_members (id) on delete set null,
  speaker_name text not null default '',
  position numeric not null default 1,
  delivery_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (message_id, gathering_id)
);

create index message_deliveries_message_idx on public.message_deliveries (message_id);
create index message_deliveries_gathering_idx on public.message_deliveries (gathering_id);

create trigger message_deliveries_set_updated_at
  before update on public.message_deliveries
  for each row execute function public.set_updated_at();

alter table public.message_deliveries enable row level security;
revoke all on public.message_deliveries from anon;
grant select, insert, update, delete on public.message_deliveries to authenticated;
grant all on public.message_deliveries to service_role;

create policy message_deliveries_select_member on public.message_deliveries
  for select using (public.is_active_member(workspace_id));
create policy message_deliveries_insert_planner on public.message_deliveries
  for insert with check (
    public.member_role(workspace_id) in ('owner', 'pastor', 'planner')
    and exists (
      select 1 from public.gatherings g
      where g.id = gathering_id and g.workspace_id = message_deliveries.workspace_id
    )
    and exists (
      select 1 from public.messages m
      where m.id = message_id and m.workspace_id = message_deliveries.workspace_id
    )
  );
create policy message_deliveries_update_planner on public.message_deliveries
  for update using (public.member_role(workspace_id) in ('owner', 'pastor', 'planner'))
  with check (
    public.member_role(workspace_id) in ('owner', 'pastor', 'planner')
    and exists (
      select 1 from public.gatherings g
      where g.id = gathering_id and g.workspace_id = message_deliveries.workspace_id
    )
    and exists (
      select 1 from public.messages m
      where m.id = message_id and m.workspace_id = message_deliveries.workspace_id
    )
  );
create policy message_deliveries_delete_planner on public.message_deliveries
  for delete using (public.member_role(workspace_id) in ('owner', 'pastor', 'planner'));
