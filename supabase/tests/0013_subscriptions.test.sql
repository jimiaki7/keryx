-- E11（課金の土台）: subscriptions の RLS / 権限を検証する。
-- 方針: 認証ユーザーは自 workspace の購読を閲覧のみ。書き込みは service_role に限る
-- （authenticated には SELECT のみ grant 済みなので insert/update は 42501）。
begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

-- A = owner（member）、B = 非メンバー
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local');

create function public.test_ws_a()
returns uuid language sql stable security definer set search_path = ''
as $$ select id from public.workspaces where slug = 'workspace-a' $$;
grant execute on function public.test_ws_a() to authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok($$ select public.create_workspace('Workspace A', 'workspace-a') $$, 'workspace A 作成');

-- 購読行は service_role 相当（superuser）が作る。ここでは superuser に戻して投入。
reset role;
insert into public.subscriptions (workspace_id, plan, status)
values ((select id from public.workspaces where slug = 'workspace-a'), 'personal', 'active');

-- A（member）は自 workspace の購読を閲覧できる
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select is(
  (select count(*)::int from public.subscriptions where workspace_id = public.test_ws_a()),
  1, 'member は自 workspace の購読を閲覧できる'
);
select is(
  (select plan from public.subscriptions where workspace_id = public.test_ws_a()),
  'personal', '購読の実データ（plan）が読める'
);

-- A は購読を書き換えられない（SELECT のみ grant → 42501）
select throws_ok(
  $$ insert into public.subscriptions (workspace_id, plan) values (public.test_ws_a(), 'church') $$,
  '42501', null, '認証ユーザーは購読を作成できない（自己アップグレード防止）'
);
select throws_ok(
  $$ update public.subscriptions set plan = 'church' where workspace_id = public.test_ws_a() $$,
  '42501', null, '認証ユーザーは購読を変更できない'
);

-- B（非メンバー）は他 workspace の購読を閲覧できない（RLS）
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select is(
  (select count(*)::int from public.subscriptions where workspace_id = public.test_ws_a()),
  0, '非メンバーは他 workspace の購読を閲覧できない'
);

select * from finish();
rollback;
