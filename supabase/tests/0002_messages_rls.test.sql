-- KX-007 / KX-005: messages・message_passages・audit_events・bible_books の検証
begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

-- テストユーザー: A = owner、B = 非メンバー、C = viewer
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user-b@test.local'),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user-c@test.local');

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
-- bible_books マスタ（KX-005）
-- ---------------------------------------------------------------------------
select is((select count(*)::int from public.bible_books), 66, 'bible_books は全66巻');

select is(
  (select count(*)::int from public.bible_books where genre = '公同書簡'),
  8,
  '公同書簡は8巻（ヘブル〜ユダ）'
);

select is(
  (select count(*)::int from public.bible_books where genre = '一般書簡'),
  0,
  '「一般書簡」ジャンルは存在しない'
);

-- ---------------------------------------------------------------------------
-- owner による Message 作成（KX-007）
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok(
  $$ select public.create_workspace('Workspace A', 'workspace-a') $$,
  'workspace を作成できる'
);

insert into public.workspace_members (workspace_id, user_id, role)
values (public.test_ws_a(), '00000000-0000-0000-0000-00000000000c', 'viewer');

select lives_ok(
  $$ insert into public.messages (workspace_id, type, title)
     values (public.test_ws_a(), 'sermon', '恐れるな、わたしはあなたとともにいる') $$,
  'owner は Message を作成できる'
);

select alike(
  (select display_id from public.messages limit 1),
  'MSG-____-0001',
  '表示IDが自動採番される（MSG-<年>-0001）'
);

select lives_ok(
  $$ insert into public.message_passages
       (message_id, workspace_id, book_id, start_chapter, start_verse, end_chapter, end_verse, display_text)
     select id, workspace_id, 'Isa', 41, 10, 41, 10, 'イザヤ41:10'
     from public.messages limit 1 $$,
  '構造化 Passage を保存できる'
);

select is(
  (select count(*)::int from public.audit_events where entity_type = 'message' and action = 'create'),
  1,
  'Message 作成で audit event が記録される'
);

-- ソフトデリート（update のみ。ハード DELETE はポリシー無しで拒否される）
update public.messages set deleted_at = now() where workspace_id = public.test_ws_a();

select is(
  (select count(*)::int from public.audit_events where action = 'soft_delete'),
  1,
  'ソフトデリートが audit event に記録される'
);

select throws_ok(
  $$ delete from public.messages where workspace_id = public.test_ws_a() $$,
  '42501',
  null,
  'Message のハード DELETE は拒否される'
);

update public.messages set deleted_at = null where workspace_id = public.test_ws_a();

-- ---------------------------------------------------------------------------
-- 非メンバー B は読めず書けない
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select is(
  (select count(*)::int from public.messages),
  0,
  '非メンバーは Message を select できない'
);

select throws_ok(
  $$ insert into public.messages (workspace_id, title)
     values (public.test_ws_a(), 'hijack') $$,
  '42501',
  null,
  '非メンバーは Message を insert できない'
);

select is(
  (select count(*)::int from public.audit_events),
  0,
  '非メンバーは audit event を閲覧できない'
);

-- ---------------------------------------------------------------------------
-- viewer C は閲覧のみ
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';

select is(
  (select count(*)::int from public.messages),
  1,
  'viewer は Message を閲覧できる'
);

select throws_ok(
  $$ insert into public.messages (workspace_id, title)
     values (public.test_ws_a(), 'viewer-write') $$,
  '42501',
  null,
  'viewer は Message を作成できない'
);

-- viewer の update は0行に作用する
update public.messages set title = 'viewer-edit' where workspace_id = public.test_ws_a();

-- ---------------------------------------------------------------------------
-- postgres 視点の最終確認
-- ---------------------------------------------------------------------------
reset role;

select is(
  (select title from public.messages limit 1),
  '恐れるな、わたしはあなたとともにいる',
  'viewer の update は反映されていない'
);

select is(
  (select count(*)::int from public.messages where deleted_at is null),
  1,
  'restore 後の Message が残っている'
);

select * from finish();
rollback;
