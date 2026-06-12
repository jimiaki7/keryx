-- KX-015: preparation_tasks（説教準備の作業と進捗）
-- 初期テンプレートは @keryx/domain（コード定義）が正本。Workspace ごとの
-- カスタムテンプレート（preparation_templates）は P1 で追加する。

create table public.preparation_tasks (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  status text not null default 'todo' check (status in ('todo', 'doing', 'done', 'skipped')),
  due_at timestamptz,
  completed_at timestamptz,
  notes text not null default '',
  position numeric not null default 1
    check (position > 0 and position < 'Infinity'::numeric),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index preparation_tasks_message_idx on public.preparation_tasks (message_id, position);
create index preparation_tasks_due_idx
  on public.preparation_tasks (workspace_id, due_at)
  where status in ('todo', 'doing');

-- completed_at は常にトリガーが管理する（INSERT/UPDATE どちらでも。任意値の書き込みは無効化）
create function public.preparation_tasks_sync_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    if new.status = 'done' then
      -- done のままの更新では完了時刻を保持し、書き換えを許さない
      new.completed_at := case when old.status = 'done' then old.completed_at else now() end;
    else
      new.completed_at := null;
    end if;
  else
    new.completed_at := case when new.status = 'done' then now() else null end;
  end if;
  return new;
end;
$$;

create trigger preparation_tasks_before_insert
  before insert on public.preparation_tasks
  for each row execute function public.preparation_tasks_sync_completed_at();
create trigger preparation_tasks_before_update
  before update on public.preparation_tasks
  for each row execute function public.preparation_tasks_sync_completed_at();

alter table public.preparation_tasks enable row level security;
revoke all on public.preparation_tasks from anon;
grant select, insert, update, delete on public.preparation_tasks to authenticated;
grant all on public.preparation_tasks to service_role;

-- 準備タスクは説教準備の一部なので owner / pastor が管理する
create policy preparation_tasks_select_member on public.preparation_tasks
  for select using (public.is_active_member(workspace_id));
create policy preparation_tasks_insert_writer on public.preparation_tasks
  for insert with check (
    public.member_role(workspace_id) in ('owner', 'pastor')
    and exists (
      select 1 from public.messages m
      where m.id = message_id
        and m.workspace_id = preparation_tasks.workspace_id
        and m.deleted_at is null
    )
  );
create policy preparation_tasks_update_writer on public.preparation_tasks
  for update using (public.member_role(workspace_id) in ('owner', 'pastor'))
  with check (
    public.member_role(workspace_id) in ('owner', 'pastor')
    and exists (
      select 1 from public.messages m
      where m.id = message_id
        and m.workspace_id = preparation_tasks.workspace_id
        and m.deleted_at is null
    )
  );
create policy preparation_tasks_delete_writer on public.preparation_tasks
  for delete using (public.member_role(workspace_id) in ('owner', 'pastor'));
