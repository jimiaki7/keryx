-- E10: 招待（invitations / peek_invitation / accept_invitation）の検証
begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

-- A = owner、E = 招待される人（email 一致）、B = 非メンバー
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e@test.local'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local');

create function public.test_ws_a()
returns uuid language sql stable security definer set search_path = ''
as $$ select id from public.workspaces where slug = 'workspace-a' $$;
grant execute on function public.test_ws_a() to authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok($$ select public.create_workspace('Workspace A', 'workspace-a') $$, 'workspace A 作成');

select lives_ok(
  $$ insert into public.invitations (workspace_id, email, role, token)
     values (public.test_ws_a(), 'e@test.local', 'planner', 't-e'),
            (public.test_ws_a(), 'nobody@test.local', 'viewer', 't-x'),
            (public.test_ws_a(), 'e@test.local', 'viewer', 't-r') $$,
  'owner は招待を作成できる'
);

select is(
  (select role from public.peek_invitation('t-e')),
  'planner', 'peek_invitation がロールを返す'
);

-- owner が取り消した招待
update public.invitations set status = 'revoked' where token = 't-r';

-- 非メンバー B は招待を作成できない
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select throws_ok(
  $$ insert into public.invitations (workspace_id, email, role, token)
     values (public.test_ws_a(), 'x@test.local', 'viewer', 't-bad') $$,
  '42501', null, '非オーナーは招待を作成できない'
);

-- E（email 一致）は招待を受けられる
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000e", "role": "authenticated"}';
select lives_ok($$ select public.accept_invitation('t-e') $$, 'email 一致なら招待を受けられる');
select is(
  (select role from public.workspace_members
    where workspace_id = public.test_ws_a() and user_id = '00000000-0000-0000-0000-00000000000e' and status = 'active'),
  'planner', '受諾で planner として active メンバーになる'
);

-- 招待の状態は owner だけが見られる（A に切替）
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select is(
  (select status from public.invitations where token = 't-e'),
  'accepted', '受諾で招待が accepted になる'
);

-- email 不一致・取り消し済みは受けられない（E に戻す）
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000e", "role": "authenticated"}';
select throws_ok(
  $$ select public.accept_invitation('t-x') $$,
  'P0001', 'this invitation is for a different email address',
  '招待メールと違うユーザーは受けられない'
);

-- 取り消し済みの招待は受けられない（t-r は revoked）
select throws_ok(
  $$ select public.accept_invitation('t-r') $$,
  'P0001', 'invitation is no longer valid',
  '取り消し済みの招待は受けられない'
);

select * from finish();
rollback;
