-- KX-025: 監査履歴（audit_events）と復元（ソフトデリート→restore）の検証
begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

-- A = owner、C = viewer、B = 非メンバー
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local'),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@test.local');

create function public.test_ws_a()
returns uuid language sql stable security definer set search_path = ''
as $$ select id from public.workspaces where slug = 'workspace-a' $$;
grant execute on function public.test_ws_a() to authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok($$ select public.create_workspace('Workspace A', 'workspace-a') $$, 'workspace A 作成');
insert into public.workspace_members (workspace_id, user_id, role)
values (public.test_ws_a(), '00000000-0000-0000-0000-00000000000c', 'viewer');

insert into public.messages (id, workspace_id, title)
values ('a1000000-0000-0000-0000-000000000001', public.test_ws_a(), '復元テスト');

-- ソフトデリート
update public.messages set deleted_at = now()
where id = 'a1000000-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from public.audit_events
    where entity_id = 'a1000000-0000-0000-0000-000000000001' and action = 'soft_delete'),
  1, 'ソフトデリートが audit に soft_delete として記録される'
);
select is(
  (select count(*)::int from public.messages
    where workspace_id = public.test_ws_a() and deleted_at is null),
  0, 'ソフトデリート後は active な messages から消える'
);

-- 復元
update public.messages set deleted_at = null
where id = 'a1000000-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from public.messages
    where workspace_id = public.test_ws_a() and deleted_at is null),
  1, '復元すると active に戻る'
);
select is(
  (select count(*)::int from public.audit_events
    where entity_id = 'a1000000-0000-0000-0000-000000000001' and action = 'restore'),
  1, '復元が audit に restore として記録される'
);

-- viewer は復元できない（messages update は owner/pastor のみ。RLS で 0 行＝no-op）
update public.messages set deleted_at = now()
where id = 'a1000000-0000-0000-0000-000000000001';
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';
update public.messages set deleted_at = null
where id = 'a1000000-0000-0000-0000-000000000001' and workspace_id = public.test_ws_a();
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select is(
  (select deleted_at is not null from public.messages where id = 'a1000000-0000-0000-0000-000000000001'),
  true, 'viewer は復元できない（削除状態のまま）'
);

-- member は監査履歴を見られる
select cmp_ok(
  (select count(*)::int from public.audit_events where workspace_id = public.test_ws_a()),
  '>=', 3, 'active member は audit_events を閲覧できる（create/soft_delete/restore…）'
);

-- 非メンバー B は監査履歴を見られない
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select is(
  (select count(*)::int from public.audit_events where workspace_id = public.test_ws_a()),
  0, '非メンバーは audit_events を select できない'
);

select * from finish();
rollback;
