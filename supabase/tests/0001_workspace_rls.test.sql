-- KX-003: Workspace RLS の許可・拒否テスト（pgTAP）
-- 実行: supabase test db
-- カバレッジ（TECHNICAL_ARCHITECTURE.md §6 必須RLSテスト）:
--   (1) 他 Workspace の select 不可
--   (2) ID 指定の update / delete 不可
--   (3) Planner の Message notes 閲覧不可 → messages 未実装のため KX-007 で追加
--   (4) Viewer は write 不可
--   (5) membership 除去後は即座にアクセス不能
begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

-- テストユーザー: A = owner、B = 非メンバー、C = viewer
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user-b@test.local'),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user-c@test.local');

select is(
  (select count(*)::int from public.profiles
   where id in ('00000000-0000-0000-0000-00000000000a',
                '00000000-0000-0000-0000-00000000000b',
                '00000000-0000-0000-0000-00000000000c')),
  3,
  'auth.users 作成で profiles が自動作成される'
);

-- RLS に関係なく workspace A の id を返すテスト用ヘルパー
-- （「IDを知っている攻撃者」を再現するため。transaction 内のみで rollback される）
create function public.test_ws_a()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.workspaces where slug = 'workspace-a'
$$;
grant execute on function public.test_ws_a() to authenticated;

-- ---------------------------------------------------------------------------
-- ユーザーA: workspace 作成と owner 権限
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok(
  $$ select public.create_workspace('Workspace A', 'workspace-a') $$,
  'ユーザーAは自分の workspace を作成できる'
);

select is(
  (select count(*)::int from public.workspaces),
  1,
  'ユーザーAは自分の workspace を閲覧できる'
);

select is(
  (select role from public.workspace_members
   where user_id = '00000000-0000-0000-0000-00000000000a'),
  'owner',
  '作成者は owner として登録される'
);

select throws_ok(
  $$ insert into public.workspaces (name, slug) values ('Direct', 'direct') $$,
  '42501',
  null,
  'workspace の直接 INSERT は拒否される（作成は RPC 経由のみ）'
);

select lives_ok(
  $$ insert into public.workspace_members (workspace_id, user_id, role)
     values (public.test_ws_a(), '00000000-0000-0000-0000-00000000000c', 'viewer') $$,
  'owner はメンバー（viewer）を追加できる'
);

-- ---------------------------------------------------------------------------
-- ユーザーB（非メンバー）: select / update / delete / insert すべて不可
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select is(
  (select count(*)::int from public.workspaces),
  0,
  'ユーザーBは workspace A を select できない'
);

select is(
  (select count(*)::int from public.workspace_members),
  0,
  'ユーザーBは workspace A のメンバー一覧を select できない'
);

-- ID を直接指定した update / delete は0行に作用する（結果は postgres 視点で後述検証）
update public.workspaces set name = 'hijacked' where id = public.test_ws_a();
delete from public.workspaces where id = public.test_ws_a();
delete from public.workspace_members where workspace_id = public.test_ws_a();

select throws_ok(
  $$ insert into public.workspace_members (workspace_id, user_id, role)
     values (public.test_ws_a(), '00000000-0000-0000-0000-00000000000b', 'owner') $$,
  '42501',
  null,
  'ユーザーBは ID を知っていても membership を自己追加できない'
);

-- ---------------------------------------------------------------------------
-- ユーザーC（viewer）: 閲覧は可、write は不可
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';

select is(
  (select count(*)::int from public.workspaces),
  1,
  'viewer は workspace を閲覧できる'
);

-- viewer の update は0行に作用する（結果は postgres 視点で後述検証）
update public.workspaces set name = 'viewer-edit' where id = public.test_ws_a();

select throws_ok(
  $$ insert into public.workspace_members (workspace_id, user_id, role)
     values (public.test_ws_a(), '00000000-0000-0000-0000-00000000000b', 'viewer') $$,
  '42501',
  null,
  'viewer はメンバーを追加できない'
);

-- ---------------------------------------------------------------------------
-- postgres 視点で、上記の拒否がすべてデータに反映されていないことを確認
-- ---------------------------------------------------------------------------
reset role;

select is(
  (select name from public.workspaces where id = public.test_ws_a()),
  'Workspace A',
  'B / viewer による update はデータに反映されていない'
);

select is(
  (select count(*)::int from public.workspaces),
  1,
  'B による delete はデータに反映されていない'
);

select is(
  (select count(*)::int from public.workspace_members),
  2,
  'membership は A(owner) と C(viewer) の2件のまま'
);

-- ---------------------------------------------------------------------------
-- membership 除去後は即座にアクセス不能
-- ---------------------------------------------------------------------------
update public.workspace_members
set status = 'removed'
where user_id = '00000000-0000-0000-0000-00000000000c';

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';

select is(
  (select count(*)::int from public.workspaces),
  0,
  'membership が removed になると即座に閲覧不能になる'
);

select * from finish();
rollback;
