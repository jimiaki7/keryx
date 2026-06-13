-- E10: メンバー表示名の相互閲覧（profiles_select_comember）とロール管理・除名の検証
begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

-- A = owner、E = 同じ workspace の planner、B = 別 workspace のユーザー（無関係）
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e@test.local'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local');

-- profiles は handle_new_user トリガーで自動作成される。表示名を設定（postgres 権限で）。
update public.profiles set display_name = 'Jimi' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set display_name = '計画太郎' where id = '00000000-0000-0000-0000-00000000000e';
update public.profiles set display_name = '無関係さん' where id = '00000000-0000-0000-0000-00000000000b';

create function public.test_ws_a()
returns uuid language sql stable security definer set search_path = ''
as $$ select id from public.workspaces where slug = 'workspace-a' $$;
grant execute on function public.test_ws_a() to authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok($$ select public.create_workspace('Workspace A', 'workspace-a') $$, 'workspace A 作成');
insert into public.workspace_members (workspace_id, user_id, role)
values (public.test_ws_a(), '00000000-0000-0000-0000-00000000000e', 'planner');

-- A は同じ workspace の E の表示名を見られる
select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000e'),
  '計画太郎', 'owner は同じ workspace のメンバーの表示名を見られる'
);
-- A は無関係な B の表示名は見られない
select is(
  (select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  0, '別 workspace の無関係ユーザーの profile は見えない'
);

-- owner はメンバー（E）のロールを変更できる
select lives_ok(
  $$ update public.workspace_members set role = 'pastor'
     where workspace_id = public.test_ws_a() and user_id = '00000000-0000-0000-0000-00000000000e' $$,
  'owner はメンバーのロールを変更できる'
);
select is(
  (select role from public.workspace_members
    where workspace_id = public.test_ws_a() and user_id = '00000000-0000-0000-0000-00000000000e'),
  'pastor', 'ロール変更が反映される'
);

-- planner/pastor（非 owner）はメンバーを管理できない（E に切替）
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000e", "role": "authenticated"}';
update public.workspace_members set role = 'owner'
  where workspace_id = public.test_ws_a() and user_id = '00000000-0000-0000-0000-00000000000a';
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select is(
  (select role from public.workspace_members
    where workspace_id = public.test_ws_a() and user_id = '00000000-0000-0000-0000-00000000000a'),
  'owner', '非 owner はロールを書き換えられない（owner のまま）'
);

-- 除名（status=removed）すると、その後 is_active_member が false になりアクセス不能
update public.workspace_members set status = 'removed'
  where workspace_id = public.test_ws_a() and user_id = '00000000-0000-0000-0000-00000000000e';
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000e", "role": "authenticated"}';
select is(public.is_active_member(public.test_ws_a()), false, '除名後は active member でなくなる');
select is(
  (select count(*)::int from public.workspace_members where workspace_id = public.test_ws_a()),
  0, '除名されたメンバーは workspace のメンバー行を見られない'
);

select * from finish();
rollback;
