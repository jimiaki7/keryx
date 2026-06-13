-- E12（AI 支援の安全な土台）: ai_suggestions と承認フロー。
-- 原則（ADR §10 / SPEC §4.5・§6.11）:
--   - AI 提案はユーザー承認を経て初めて正本（messages の列）になる。自動書き込みしない。
--   - 提案は pending として保存し、承認 RPC のみが正本へ反映する。
--   - 認証ユーザーは閲覧と「pending 提案の作成」だけ。status の変更は RPC 経由のみ
--     （直接 update 権限を与えない＝勝手に approved にできない）。
--   - 本文・API キーは保存・記録しない。model は監査のため保持する。

create table public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  -- 提案の種類＝反映先の正本フィールド（allowlist）。将来 themes 等を足す余地を残す。
  kind text not null check (kind in ('summary', 'central_message')),
  content text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  -- 監査用。秘密情報は入れない（model id のみ）。
  model text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz
);

create index ai_suggestions_message_idx
  on public.ai_suggestions (workspace_id, message_id, status);

-- 同じ message・同じ kind の pending 提案は1件まで（重複生成で AI 費用と画面を浪費しない）。
create unique index ai_suggestions_one_pending_per_kind
  on public.ai_suggestions (message_id, kind)
  where status = 'pending';

create function public.ai_suggestions_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_by := coalesce(new.created_by, (select auth.uid()));
  -- 作成時は必ず pending。レビュー情報は持たない（多層防御）。
  new.status := 'pending';
  new.reviewed_by := null;
  new.reviewed_at := null;
  return new;
end;
$$;

create trigger ai_suggestions_before_insert
  before insert on public.ai_suggestions
  for each row execute function public.ai_suggestions_before_insert();

-- RLS: 閲覧は active member。作成は owner/pastor（= message を編集できる役割）かつ
-- 対象 message が自 workspace の生存行であること。update/delete 権限は付与しない。
alter table public.ai_suggestions enable row level security;
revoke all on public.ai_suggestions from anon;
grant select, insert on public.ai_suggestions to authenticated;
grant all on public.ai_suggestions to service_role;

create policy ai_suggestions_select_member on public.ai_suggestions
  for select using (public.is_active_member(workspace_id));

create policy ai_suggestions_insert_writer on public.ai_suggestions
  for insert with check (
    public.member_role(workspace_id) in ('owner', 'pastor')
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and exists (
      select 1 from public.messages m
      where m.id = message_id
        and m.workspace_id = ai_suggestions.workspace_id
        and m.deleted_at is null
    )
  );

-- 承認: pending 提案を正本へ反映し approved にする。security definer だが、
-- owner/pastor を明示的に検証する（RLS を迂回するため）。
create function public.approve_ai_suggestion(p_suggestion_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.ai_suggestions;
begin
  select * into s from public.ai_suggestions where id = p_suggestion_id;
  if not found then
    raise exception 'suggestion not found' using errcode = 'P0002';
  end if;
  -- NULL 安全な権限チェック。member_role は非メンバーで NULL を返すため、
  -- 素の `NULL not in (...)` は NULL（=偽扱い）になり認可を素通りしてしまう。
  -- coalesce で非メンバー・不足ロールを確実に拒否する（DEFINER は RLS を迂回するため必須）。
  if coalesce(public.member_role(s.workspace_id), '') not in ('owner', 'pastor') then
    raise exception 'insufficient role' using errcode = '42501';
  end if;
  if s.status <> 'pending' then
    raise exception 'suggestion is not pending' using errcode = 'P0001';
  end if;

  -- allowlist による正本反映。動的 SQL は使わない。
  if s.kind = 'summary' then
    update public.messages set summary = s.content
      where id = s.message_id and workspace_id = s.workspace_id and deleted_at is null;
  elsif s.kind = 'central_message' then
    update public.messages set central_message = s.content
      where id = s.message_id and workspace_id = s.workspace_id and deleted_at is null;
  else
    raise exception 'unsupported suggestion kind' using errcode = 'P0001';
  end if;
  if not found then
    raise exception 'target message not found' using errcode = 'P0002';
  end if;

  update public.ai_suggestions
    set status = 'approved', reviewed_by = (select auth.uid()),
        reviewed_at = now(), updated_at = now()
    where id = p_suggestion_id;
end;
$$;

-- 却下: 正本へは触れず rejected にする。
create function public.reject_ai_suggestion(p_suggestion_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.ai_suggestions;
begin
  select * into s from public.ai_suggestions where id = p_suggestion_id;
  if not found then
    raise exception 'suggestion not found' using errcode = 'P0002';
  end if;
  -- NULL 安全な権限チェック。member_role は非メンバーで NULL を返すため、
  -- 素の `NULL not in (...)` は NULL（=偽扱い）になり認可を素通りしてしまう。
  -- coalesce で非メンバー・不足ロールを確実に拒否する（DEFINER は RLS を迂回するため必須）。
  if coalesce(public.member_role(s.workspace_id), '') not in ('owner', 'pastor') then
    raise exception 'insufficient role' using errcode = '42501';
  end if;
  if s.status <> 'pending' then
    raise exception 'suggestion is not pending' using errcode = 'P0001';
  end if;
  update public.ai_suggestions
    set status = 'rejected', reviewed_by = (select auth.uid()),
        reviewed_at = now(), updated_at = now()
    where id = p_suggestion_id;
end;
$$;

revoke execute on function public.approve_ai_suggestion(uuid) from public, anon;
revoke execute on function public.reject_ai_suggestion(uuid) from public, anon;
grant execute on function public.approve_ai_suggestion(uuid) to authenticated;
grant execute on function public.reject_ai_suggestion(uuid) to authenticated;
