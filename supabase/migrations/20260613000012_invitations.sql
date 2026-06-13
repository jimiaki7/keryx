-- E10（協働）: メンバー招待。owner が email + ロールで招待を作成し、トークン付きリンクを共有する。
-- 招待されたメールで本人がサインイン/ログインし accept_invitation で参加する。
-- メール送信基盤に依存せず（リンク共有で成立）、メール自動送信は後段で追加できる。

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null check (length(trim(email)) > 0),
  -- owner は招待できない（owner はワークスペース作成者のみ）
  role text not null check (role in ('pastor', 'planner', 'viewer')),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_by uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_by uuid,
  accepted_at timestamptz
);

create index invitations_workspace_idx on public.invitations (workspace_id, status);

alter table public.invitations enable row level security;
revoke all on public.invitations from anon;
grant select, insert, update on public.invitations to authenticated;
grant all on public.invitations to service_role;

-- owner のみ招待を管理できる（一覧・作成・取り消し）
create policy invitations_select_owner on public.invitations
  for select using (public.member_role(workspace_id) = 'owner');
create policy invitations_insert_owner on public.invitations
  for insert with check (public.member_role(workspace_id) = 'owner');
create policy invitations_update_owner on public.invitations
  for update using (public.member_role(workspace_id) = 'owner')
  with check (public.member_role(workspace_id) = 'owner');

-- 招待のプレビュー（リンクを開いた本人が、参加前に workspace 名・ロール・状態を確認する）
create function public.peek_invitation(p_token text)
returns table (workspace_name text, role text, status text, expired boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select w.name, i.role, i.status, (i.expires_at <= now())
  from public.invitations i
  join public.workspaces w on w.id = i.workspace_id
  where i.token = p_token;
$$;

revoke execute on function public.peek_invitation(text) from public, anon;
grant execute on function public.peek_invitation(text) to authenticated;

-- 招待を受ける（認証済み・招待メールと一致が必要）。member 行を作成し招待を accepted にする。
create function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invitations;
  uid uuid := (select auth.uid());
  uemail text;
begin
  if uid is null then
    raise exception 'authentication required';
  end if;
  select * into inv from public.invitations where token = p_token;
  if inv.id is null then
    raise exception 'invitation not found';
  end if;
  if inv.status <> 'pending' then
    raise exception 'invitation is no longer valid';
  end if;
  if inv.expires_at <= now() then
    raise exception 'invitation has expired';
  end if;
  select email into uemail from auth.users where id = uid;
  if lower(btrim(inv.email)) <> lower(btrim(coalesce(uemail, ''))) then
    raise exception 'this invitation is for a different email address';
  end if;
  -- すでに active メンバーなら受けない（owner の自己降格・二重参加を防ぐ）
  if exists (
    select 1 from public.workspace_members
    where workspace_id = inv.workspace_id and user_id = uid and status = 'active'
  ) then
    raise exception 'already a member of this workspace';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (inv.workspace_id, uid, inv.role, 'active')
  on conflict (workspace_id, user_id)
  do update set role = excluded.role, status = 'active';

  update public.invitations
    set status = 'accepted', accepted_by = uid, accepted_at = now()
    where id = inv.id;

  return inv.workspace_id;
end;
$$;

revoke execute on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;
