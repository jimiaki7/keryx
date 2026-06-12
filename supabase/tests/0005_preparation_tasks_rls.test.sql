-- KX-015: preparation_tasks（説教準備の作業と進捗）の検証
begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

-- テストユーザー: A = owner、B = 非メンバー、C = viewer、D = 越境攻撃者（ws-A owner かつ ws-B owner）
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user-b@test.local'),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user-c@test.local'),
  ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user-d@test.local');

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

create function public.test_ws_b()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.workspaces where slug = 'workspace-b'
$$;
grant execute on function public.test_ws_b() to authenticated;

-- ---------------------------------------------------------------------------
-- owner A: workspace / message を用意し、preparation_tasks を複数追加（KX-015）
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok(
  $$ select public.create_workspace('Workspace A', 'workspace-a') $$,
  'workspace を作成できる'
);

insert into public.workspace_members (workspace_id, user_id, role)
values (public.test_ws_a(), '00000000-0000-0000-0000-00000000000c', 'viewer');

insert into public.messages (workspace_id, type, title)
values (public.test_ws_a(), 'sermon', '恐れるな、わたしはあなたとともにいる');

select lives_ok(
  $$ insert into public.preparation_tasks (message_id, workspace_id, title, position)
     select m.id, public.test_ws_a(), v.title, v.position
     from public.messages m,
          (values
            ('釈義', 1::numeric),
            ('骨子', 2::numeric),
            ('原稿', 3::numeric)
          ) as v (title, position)
     where m.workspace_id = public.test_ws_a() $$,
  'owner は preparation_tasks を複数追加できる'
);

select is(
  (select count(*)::int from public.preparation_tasks),
  3,
  'preparation_tasks が3行登録されている'
);

-- status を done にすると completed_at が trigger で自動設定される
update public.preparation_tasks set status = 'done' where title = '釈義';

select is(
  (select completed_at is not null from public.preparation_tasks where title = '釈義'),
  true,
  'status を done に更新すると completed_at が自動設定される'
);

-- done から todo に戻すと completed_at は null に戻る
update public.preparation_tasks set status = 'todo' where title = '釈義';

select is(
  (select completed_at from public.preparation_tasks where title = '釈義'),
  null::timestamptz,
  'done から todo に戻すと completed_at は null に戻る'
);

-- skipped（進捗率の分母から除外する状態）を設定できる
select lives_ok(
  $$ update public.preparation_tasks set status = 'skipped' where title = '骨子' $$,
  'skipped 状態を設定できる'
);

select is(
  (select status from public.preparation_tasks where title = '骨子'),
  'skipped',
  'skipped 状態が保存されている'
);

-- 空 title は check 制約違反
select throws_ok(
  $$ insert into public.preparation_tasks (message_id, workspace_id, title)
     select m.id, public.test_ws_a(), '   '
     from public.messages m
     where m.workspace_id = public.test_ws_a() $$,
  '23514',
  null,
  '空 title は check 制約で拒否される'
);

-- ---------------------------------------------------------------------------
-- viewer C は insert できない
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';

select throws_ok(
  $$ insert into public.preparation_tasks (message_id, workspace_id, title)
     select m.id, public.test_ws_a(), 'viewer-task'
     from public.messages m
     where m.workspace_id = public.test_ws_a() $$,
  '42501',
  null,
  'viewer は preparation_tasks を insert できない'
);

-- ---------------------------------------------------------------------------
-- 非メンバー B は読めない
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select is(
  (select count(*)::int from public.preparation_tasks),
  0,
  '非メンバーは preparation_tasks を select できない'
);

-- ---------------------------------------------------------------------------
-- 越境リンク防止（攻撃者 D は ws-A owner かつ ws-B owner）
-- 自分の workspace_id（A）を保ったまま、ws-B の message を指すタスクを作れてはならない
-- ---------------------------------------------------------------------------
reset role;
insert into public.workspaces (id, name, slug)
values (gen_random_uuid(), 'Workspace B', 'workspace-b');
insert into public.workspace_members (workspace_id, user_id, role)
values
  (public.test_ws_a(), '00000000-0000-0000-0000-00000000000d', 'owner'),
  (public.test_ws_b(), '00000000-0000-0000-0000-00000000000d', 'owner');
insert into public.messages (workspace_id, type, title)
values (public.test_ws_b(), 'sermon', 'B-message-secret');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000d", "role": "authenticated"}';

-- workspace_id=A を指定しつつ message は ws-B のものを参照 → 拒否されるべき
select throws_ok(
  $$ insert into public.preparation_tasks (message_id, workspace_id, title)
     select (select id from public.messages where workspace_id = public.test_ws_b()),
            public.test_ws_a(), 'cross-task' $$,
  '42501',
  null,
  '越境リンク: A の workspace_id で B の message にタスクを insert できない'
);

-- ---------------------------------------------------------------------------
-- ソフトデリート済み message へのタスク追加は拒否される
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

insert into public.messages (workspace_id, type, title)
values (public.test_ws_a(), 'sermon', 'ソフトデリート対象');

update public.messages
set deleted_at = now()
where workspace_id = public.test_ws_a() and title = 'ソフトデリート対象';

select throws_ok(
  $$ insert into public.preparation_tasks (message_id, workspace_id, title)
     select m.id, public.test_ws_a(), 'deleted-message-task'
     from public.messages m
     where m.workspace_id = public.test_ws_a() and m.title = 'ソフトデリート対象' $$,
  '42501',
  null,
  'ソフトデリート済み message へのタスク insert は拒否される'
);

-- ---------------------------------------------------------------------------
-- postgres 視点の最終確認（message 物理削除で preparation_tasks も消える）
-- ---------------------------------------------------------------------------
reset role;

delete from public.messages where workspace_id = public.test_ws_a();

select is(
  (select count(*)::int from public.preparation_tasks),
  0,
  'message 物理削除で preparation_tasks は cascade 削除される'
);

select * from finish();
rollback;
