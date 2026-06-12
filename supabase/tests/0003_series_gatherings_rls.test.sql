-- KX-010 / KX-011: series・series_messages・venues・gatherings・message_deliveries の検証
begin;

create extension if not exists pgtap with schema extensions;

select plan(25);

-- テストユーザー: A = owner、B = 非メンバー、C = viewer、D = 越境攻撃者（ws-A owner かつ ws-B viewer）
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
-- owner A: workspace 作成と series（KX-010）
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
  $$ insert into public.series (workspace_id, name)
     values (public.test_ws_a(), '創世記連続講解') $$,
  'owner は series を作成できる'
);

-- series_messages（シリーズへの Message 追加と順序）
insert into public.messages (workspace_id, type, title)
values (public.test_ws_a(), 'sermon', '初めに神が天と地を創造された');

select lives_ok(
  $$ insert into public.series_messages (series_id, message_id, workspace_id, position)
     select s.id, m.id, public.test_ws_a(), 1
     from public.series s, public.messages m $$,
  'owner は Message をシリーズへ追加できる'
);

select throws_ok(
  $$ insert into public.series_messages (series_id, message_id, workspace_id, position)
     select s.id, m.id, public.test_ws_a(), 2
     from public.series s, public.messages m $$,
  '23505',
  null,
  '同じ series と Message の組は重複登録できない'
);

-- 物理削除テストに備えて主シリーズを設定しておく
update public.messages
set primary_series_id = (select id from public.series limit 1)
where workspace_id = public.test_ws_a();

-- ---------------------------------------------------------------------------
-- owner A: venues / gatherings / message_deliveries（KX-011）
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.venues (workspace_id, name)
     values (public.test_ws_a(), '本会堂') $$,
  'owner は venue を作成できる'
);

select throws_ok(
  $$ insert into public.venues (workspace_id, name)
     values (public.test_ws_a(), '本会堂') $$,
  '23505',
  null,
  '同名 venue は二重作成できない'
);

select lives_ok(
  $$ insert into public.gatherings (workspace_id, title, starts_at)
     values (public.test_ws_a(), '主日礼拝', '2026-06-14 10:30+09') $$,
  'owner は gathering を作成できる'
);

select alike(
  (select display_id from public.gatherings limit 1),
  'GTH-____-0001',
  '表示IDが自動採番される（GTH-<年>-0001）'
);

-- 同じ Message を2つの Gathering で語る（message_deliveries）
insert into public.gatherings (workspace_id, title, starts_at)
values (public.test_ws_a(), '夕拝', '2026-06-14 19:00+09');

select lives_ok(
  $$ insert into public.message_deliveries (message_id, gathering_id, workspace_id)
     select m.id, g.id, public.test_ws_a()
     from public.messages m, public.gatherings g $$,
  '同じ Message を2つの gathering に関連付けられる'
);

select is(
  (select count(*)::int from public.message_deliveries),
  2,
  'message_deliveries が2行ある'
);

select throws_ok(
  $$ insert into public.message_deliveries (message_id, gathering_id, workspace_id)
     select m.id, g.id, public.test_ws_a()
     from public.messages m, public.gatherings g
     limit 1 $$,
  '23505',
  null,
  '同じ Message と gathering の組は重複登録できない'
);

-- ハード DELETE は delete policy も grant も無いため拒否される
select throws_ok(
  $$ delete from public.series where workspace_id = public.test_ws_a() $$,
  '42501',
  null,
  'series のハード DELETE は拒否される'
);

-- ---------------------------------------------------------------------------
-- 非メンバー B は読めず書けない
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select is(
  (select count(*)::int from public.series),
  0,
  '非メンバーは series を select できない'
);

select throws_ok(
  $$ insert into public.series (workspace_id, name)
     values (public.test_ws_a(), 'hijack-series') $$,
  '42501',
  null,
  '非メンバーは series を insert できない'
);

select is(
  (select count(*)::int from public.venues),
  0,
  '非メンバーは venue を select できない'
);

select is(
  (select count(*)::int from public.message_deliveries),
  0,
  '非メンバーは message_deliveries を select できない'
);

-- ---------------------------------------------------------------------------
-- viewer C は閲覧のみ
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';

select is(
  (select count(*)::int from public.series),
  1,
  'viewer は series を select できる'
);

-- viewer の update は0行に作用する
update public.series set name = 'viewer-edit' where workspace_id = public.test_ws_a();

select throws_ok(
  $$ insert into public.gatherings (workspace_id, title, starts_at)
     values (public.test_ws_a(), 'viewer-gathering', now()) $$,
  '42501',
  null,
  'viewer は gathering を insert できない'
);

-- ---------------------------------------------------------------------------
-- 越境リンク防止（レビュー検出の脆弱性。攻撃者 D は ws-A の owner かつ ws-B の viewer）
-- 自分の workspace_id（A）を保ったまま、ws-B の series/message を指すリンクを作れてはならない
-- ---------------------------------------------------------------------------
reset role;
-- ws-B を D 所有で用意し、A 側からも参照できるよう D を ws-A owner、ws-B owner にする
insert into public.workspaces (id, name, slug)
values (gen_random_uuid(), 'Workspace B', 'workspace-b');
insert into public.workspace_members (workspace_id, user_id, role)
values
  (public.test_ws_a(), '00000000-0000-0000-0000-00000000000d', 'owner'),
  (public.test_ws_b(), '00000000-0000-0000-0000-00000000000d', 'owner');
-- ws-A に series、ws-B に message を1件ずつ用意
insert into public.series (workspace_id, name) values (public.test_ws_a(), 'A-series-for-cross');
insert into public.messages (workspace_id, type, title)
values (public.test_ws_b(), 'sermon', 'B-message-secret');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000d", "role": "authenticated"}';

-- workspace_id=A を指定しつつ message は ws-B のものを参照 → 拒否されるべき
select throws_ok(
  $$ insert into public.series_messages (series_id, message_id, workspace_id)
     select (select id from public.series where workspace_id = public.test_ws_a() and name = 'A-series-for-cross'),
            (select id from public.messages where workspace_id = public.test_ws_b()),
            public.test_ws_a() $$,
  '42501',
  null,
  '越境リンク: A の series_messages に B の message を insert できない'
);

-- 正規の A 内リンクを作り、それを UPDATE で B の message へ書き換えようとする → 拒否されるべき
insert into public.messages (workspace_id, type, title)
values (public.test_ws_a(), 'sermon', 'A-message-legit');
insert into public.series_messages (series_id, message_id, workspace_id)
select (select id from public.series where workspace_id = public.test_ws_a() and name = 'A-series-for-cross'),
       (select id from public.messages where workspace_id = public.test_ws_a() and title = 'A-message-legit'),
       public.test_ws_a();

select throws_ok(
  $$ update public.series_messages
     set message_id = (select id from public.messages where workspace_id = public.test_ws_b())
     where workspace_id = public.test_ws_a()
       and message_id = (select id from public.messages where workspace_id = public.test_ws_a() and title = 'A-message-legit') $$,
  '42501',
  null,
  '越境リンク: A の series_messages を B の message へ UPDATE で付け替えられない'
);

select is(
  (select count(*)::int from public.series_messages sm
   join public.messages m on m.id = sm.message_id
   where sm.workspace_id != m.workspace_id),
  0,
  '越境リンク（workspace 不一致の series_messages）は存在しない'
);

-- ---------------------------------------------------------------------------
-- postgres 視点の最終確認（KX-010: シリーズ削除でも Message は残る）
-- ---------------------------------------------------------------------------
reset role;
-- 以降の「Message は残る」検証を単純化するため、越境テスト用の付随データを除去
delete from public.series_messages
  where series_id in (select id from public.series where name = 'A-series-for-cross');
delete from public.series where name = 'A-series-for-cross';
delete from public.messages where title in ('A-message-legit', 'B-message-secret');
delete from public.workspaces where slug = 'workspace-b';

select is(
  (select name from public.series limit 1),
  '創世記連続講解',
  'viewer の update は反映されていない'
);

delete from public.series;

select is(
  (select count(*)::int from public.series_messages),
  0,
  'series 削除で series_messages は消える'
);

select is(
  (select count(*)::int from public.messages),
  1,
  'series を削除しても Message は削除されない'
);

select is(
  (select primary_series_id from public.messages limit 1),
  null::uuid,
  'series 削除後、messages.primary_series_id は null になる'
);

select * from finish();
rollback;
