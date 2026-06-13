-- E10（協働）の足がかり: 同じ Workspace の active メンバー同士が表示名を見られるようにする。
-- これまで profiles は本人のみ閲覧可（profiles_select_own）だったため、メンバー一覧で
-- 他メンバーの名前を出せなかった。security definer 関数で workspace_members の RLS 再帰を回避する。

create function public.shares_active_workspace(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members me
    join public.workspace_members them on them.workspace_id = me.workspace_id
    where me.user_id = (select auth.uid()) and me.status = 'active'
      and them.user_id = target_user and them.status = 'active'
  );
$$;

revoke execute on function public.shares_active_workspace(uuid) from public, anon;
grant execute on function public.shares_active_workspace(uuid) to authenticated;

-- 本人（profiles_select_own）に加えて、同じ workspace の active メンバーの表示名も閲覧可に。
-- 公開するのは display_name のみ（profiles はそれ以外の機微情報を持たない）。
create policy profiles_select_comember on public.profiles
  for select using (public.shares_active_workspace(id));
