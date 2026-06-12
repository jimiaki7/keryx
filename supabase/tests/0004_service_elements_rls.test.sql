-- KX-013: service_elements（並べ替え可能な礼拝順序）の検証
begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

-- テストユーザー: A = owner、B = 非メンバー、C = viewer、D = 越境攻撃者（ws-A owner かつ ws-B owner）、E = planner
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user-b@test.local'),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user-c@test.local'),
  ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user-d@test.local'),
  ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user-e@test.local');

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
-- owner A: workspace / gathering を用意し、service_elements を追加（KX-013）
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok(
  $$ select public.create_workspace('Workspace A', 'workspace-a') $$,
  'workspace を作成できる'
);

insert into public.workspace_members (workspace_id, user_id, role)
values
  (public.test_ws_a(), '00000000-0000-0000-0000-00000000000c', 'viewer'),
  (public.test_ws_a(), '00000000-0000-0000-0000-00000000000e', 'planner');

insert into public.gatherings (workspace_id, title, starts_at)
values (public.test_ws_a(), '主日礼拝', '2026-06-14 10:30+09');

select lives_ok(
  $$ insert into public.service_elements (gathering_id, workspace_id, position, type, title)
     select g.id, public.test_ws_a(), 0.5, 'call_to_worship', '招詞'
     from public.gatherings g
     where g.workspace_id = public.test_ws_a() $$,
  'owner は標準タイプ（call_to_worship）の要素を追加できる'
);

select lives_ok(
  $$ insert into public.service_elements (gathering_id, workspace_id, position, type, title)
     select g.id, public.test_ws_a(), 9, 'custom', '報告'
     from public.gatherings g
     where g.workspace_id = public.test_ws_a() $$,
  'owner は custom 要素を追加できる'
);

-- 複数 hymn / 複数 ceremony を登録し、ceremony の前後に hymn を配置できる
insert into public.service_elements (gathering_id, workspace_id, position, type, title, metadata)
select g.id, public.test_ws_a(), v.position, v.type, v.title, v.metadata
from public.gatherings g,
     (values
       (1::numeric, 'hymn', '開会賛美', '{}'::jsonb),
       (2::numeric, 'ceremony', '聖餐式', '{"ceremony_type": "communion"}'::jsonb),
       (3::numeric, 'hymn', '応答賛美', '{}'::jsonb),
       (4::numeric, 'ceremony', '献児式', '{"ceremony_type": "other"}'::jsonb)
     ) as v (position, type, title, metadata)
where g.workspace_id = public.test_ws_a();

select is(
  (select count(*)::int from public.service_elements where type = 'hymn'),
  2,
  'hymn を複数（2行）登録できる'
);

select is(
  (select count(*)::int from public.service_elements where type = 'ceremony'),
  2,
  'ceremony を複数（2行）登録できる'
);

select is(
  (select array_agg(type order by position)
   from public.service_elements
   where type in ('hymn', 'ceremony')),
  array['hymn', 'ceremony', 'hymn', 'ceremony'],
  'position 順で hymn → ceremony → hymn の順に配置できる'
);

-- invalid type は check 制約違反
select throws_ok(
  $$ insert into public.service_elements (gathering_id, workspace_id, position, type, title)
     select g.id, public.test_ws_a(), 10, 'sermon_notes', '不正タイプ'
     from public.gatherings g
     where g.workspace_id = public.test_ws_a() $$,
  '23514',
  null,
  '定義外の type は check 制約で拒否される'
);

-- ---------------------------------------------------------------------------
-- planner E は要素を追加・更新・削除できる
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000e", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.service_elements (gathering_id, workspace_id, position, type, title)
     select g.id, public.test_ws_a(), 5, 'prayer', 'planner-prayer'
     from public.gatherings g
     where g.workspace_id = public.test_ws_a() $$,
  'planner は要素を追加できる'
);

select lives_ok(
  $$ update public.service_elements
     set title = 'planner-prayer-edited'
     where title = 'planner-prayer' $$,
  'planner は要素を更新できる'
);

select lives_ok(
  $$ delete from public.service_elements
     where title = 'planner-prayer-edited' $$,
  'planner は要素を削除できる'
);

-- ---------------------------------------------------------------------------
-- viewer C は insert できない
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';

select throws_ok(
  $$ insert into public.service_elements (gathering_id, workspace_id, position, type, title)
     select g.id, public.test_ws_a(), 6, 'hymn', 'viewer-hymn'
     from public.gatherings g
     where g.workspace_id = public.test_ws_a() $$,
  '42501',
  null,
  'viewer は要素を insert できない'
);

-- ---------------------------------------------------------------------------
-- 非メンバー B は読めない
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select is(
  (select count(*)::int from public.service_elements),
  0,
  '非メンバーは service_elements を select できない'
);

-- ---------------------------------------------------------------------------
-- 越境リンク防止（攻撃者 D は ws-A owner かつ ws-B owner）
-- 自分の workspace_id（A）を保ったまま、ws-B の gathering を指す要素を作れてはならない
-- ---------------------------------------------------------------------------
reset role;
insert into public.workspaces (id, name, slug)
values (gen_random_uuid(), 'Workspace B', 'workspace-b');
insert into public.workspace_members (workspace_id, user_id, role)
values
  (public.test_ws_a(), '00000000-0000-0000-0000-00000000000d', 'owner'),
  (public.test_ws_b(), '00000000-0000-0000-0000-00000000000d', 'owner');
insert into public.gatherings (workspace_id, title, starts_at)
values (public.test_ws_b(), 'B-gathering', '2026-06-21 10:30+09');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000d", "role": "authenticated"}';

-- workspace_id=A を指定しつつ gathering は ws-B のものを参照 → 拒否されるべき
select throws_ok(
  $$ insert into public.service_elements (gathering_id, workspace_id, position, type, title)
     select (select id from public.gatherings where workspace_id = public.test_ws_b()),
            public.test_ws_a(), 1, 'hymn', 'cross-hymn' $$,
  '42501',
  null,
  '越境リンク: A の workspace_id で B の gathering に要素を insert できない'
);

-- ---------------------------------------------------------------------------
-- postgres 視点の最終確認（gathering 削除で service_elements も消える）
-- ---------------------------------------------------------------------------
reset role;

delete from public.gatherings where workspace_id = public.test_ws_a();

select is(
  (select count(*)::int from public.service_elements),
  0,
  'gathering 削除で service_elements は cascade 削除される'
);

select * from finish();
rollback;
