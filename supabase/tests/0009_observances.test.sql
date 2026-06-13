-- KX-024: observances（教会暦）の RLS・制約検証
begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

-- A = owner、C = viewer、E = planner、B = 非メンバー
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local'),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@test.local'),
  ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e@test.local');

create function public.test_ws_a()
returns uuid language sql stable security definer set search_path = ''
as $$ select id from public.workspaces where slug = 'workspace-a' $$;
grant execute on function public.test_ws_a() to authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok($$ select public.create_workspace('Workspace A', 'workspace-a') $$, 'workspace A 作成');

insert into public.workspace_members (workspace_id, user_id, role)
values
  (public.test_ws_a(), '00000000-0000-0000-0000-00000000000c', 'viewer'),
  (public.test_ws_a(), '00000000-0000-0000-0000-00000000000e', 'planner');

select lives_ok(
  $$ insert into public.observances (workspace_id, name, kind, starts_on, ends_on, source, preset_key)
     values (public.test_ws_a(), 'イースター（復活祭）', 'easter', '2026-04-05', '2026-04-05', 'preset', 'easter-2026') $$,
  'owner はプリセット observance を作成できる'
);

select throws_ok(
  $$ insert into public.observances (workspace_id, name, kind, starts_on, ends_on, source, preset_key)
     values (public.test_ws_a(), 'イースター重複', 'easter', '2026-04-05', '2026-04-05', 'preset', 'easter-2026') $$,
  '23505', null, '同一 workspace で preset_key 重複は拒否（再適用の冪等性）'
);

select throws_ok(
  $$ insert into public.observances (workspace_id, name, starts_on, ends_on)
     values (public.test_ws_a(), '逆転', '2026-04-10', '2026-04-05') $$,
  '23514', null, 'ends_on < starts_on は check 制約で拒否'
);

-- custom は preset_key=null で複数作れる（NULL は一意制約で衝突しない）
select lives_ok(
  $$ insert into public.observances (workspace_id, name, kind, starts_on, ends_on)
     select public.test_ws_a(), v.n, 'custom', '2026-07-01', '2026-07-01'
     from (values ('教会創立記念'), ('特別伝道集会')) as v(n) $$,
  'custom は preset_key なしで複数作成できる'
);

-- planner E は作成・更新できる
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000e", "role": "authenticated"}';
select lives_ok(
  $$ update public.observances set name = 'イースター' where preset_key = 'easter-2026' $$,
  'planner は observance を更新（名称変更）できる'
);

-- viewer C は作成できない
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';
select throws_ok(
  $$ insert into public.observances (workspace_id, name, starts_on, ends_on)
     values (public.test_ws_a(), 'viewer不可', '2026-08-01', '2026-08-01') $$,
  '42501', null, 'viewer は observance を作成できない'
);

-- 非メンバー B は読めない・書けない（越境）
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select is(
  (select count(*)::int from public.observances),
  0, '非メンバーは observance を select できない'
);
select throws_ok(
  $$ insert into public.observances (workspace_id, name, starts_on, ends_on)
     values (public.test_ws_a(), '越境', '2026-09-01', '2026-09-01') $$,
  '42501', null, '非メンバーは他 workspace に observance を insert できない（越境防止）'
);

-- viewer C は読める（active member）
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';
select is(
  (select count(*)::int from public.observances where workspace_id = public.test_ws_a()),
  3, 'active member（viewer）は observance を閲覧できる（preset1 + custom2）'
);

select * from finish();
rollback;
