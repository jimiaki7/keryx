-- KX-023: message_analytics の集計値を fixture で検証
begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

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

-- M1: 旧約(Gen)+新約(Matt)、主題=契約、2回実施（1月・3月）
-- M2: 旧約(Ps)、主題=祈り、6月実施
-- M3: 聖書箇所なし、主題=恵み、1月実施
-- M4: 新約 公同書簡(Heb)、主題なし、2月実施
insert into public.messages (id, workspace_id, type, title, metadata) values
  ('a1000000-0000-0000-0000-000000000001', public.test_ws_a(), 'sermon', 'M1', '{"legacy":{"theme":"契約"}}'::jsonb),
  ('a2000000-0000-0000-0000-000000000002', public.test_ws_a(), 'sermon', 'M2', '{"legacy":{"theme":"祈り"}}'::jsonb),
  ('a3000000-0000-0000-0000-000000000003', public.test_ws_a(), 'sermon', 'M3', '{"legacy":{"theme":"恵み"}}'::jsonb),
  ('a4000000-0000-0000-0000-000000000004', public.test_ws_a(), 'sermon', 'M4', '{}'::jsonb);

insert into public.message_passages (message_id, workspace_id, role, position, book_id, start_chapter, end_chapter, display_text) values
  ('a1000000-0000-0000-0000-000000000001', public.test_ws_a(), 'primary', 1, 'Gen', 1, 1, '創世記1'),
  ('a1000000-0000-0000-0000-000000000001', public.test_ws_a(), 'supporting', 2, 'Matt', 1, 1, 'マタイ1'),
  ('a2000000-0000-0000-0000-000000000002', public.test_ws_a(), 'primary', 1, 'Ps', 1, 1, '詩篇1'),
  ('a4000000-0000-0000-0000-000000000004', public.test_ws_a(), 'primary', 1, 'Heb', 1, 1, 'ヘブル1');

insert into public.gatherings (id, workspace_id, title, kind, starts_at) values
  ('b1000000-0000-0000-0000-000000000001', public.test_ws_a(), '1月', 'sunday_worship', '2026-01-04 10:30+09'),
  ('b1000000-0000-0000-0000-000000000002', public.test_ws_a(), '3月', 'sunday_worship', '2026-03-01 10:30+09'),
  ('b2000000-0000-0000-0000-000000000003', public.test_ws_a(), '6月', 'sunday_worship', '2026-06-10 10:30+09'),
  ('b3000000-0000-0000-0000-000000000004', public.test_ws_a(), '1月b', 'sunday_worship', '2026-01-05 10:30+09'),
  ('b4000000-0000-0000-0000-000000000005', public.test_ws_a(), '2月', 'sunday_worship', '2026-02-02 10:30+09');

insert into public.message_deliveries (message_id, gathering_id, workspace_id) values
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', public.test_ws_a()),
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', public.test_ws_a()),
  ('a2000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000003', public.test_ws_a()),
  ('a3000000-0000-0000-0000-000000000003', 'b3000000-0000-0000-0000-000000000004', public.test_ws_a()),
  ('a4000000-0000-0000-0000-000000000004', 'b4000000-0000-0000-0000-000000000005', public.test_ws_a());

create temp table an as select public.message_analytics(public.test_ws_a()) as j;

select is(((select j from an) -> 'totals' ->> 'messages')::int, 4, 'Message 数は4');
select is(((select j from an) -> 'totals' ->> 'deliveries')::int, 5, 'Delivery 数は5（M1 は2回実施）');
select is(((select j from an) -> 'totals' ->> 'messages_with_passage')::int, 3, '聖書箇所のある Message は3');
select is(((select j from an) -> 'totals' ->> 'messages_with_theme')::int, 3, '主題のある Message は3（M4 は主題なし）');

select is(
  (select (e ->> 'messages')::int from jsonb_array_elements((select j from an) -> 'testament') e
   where e ->> 'key' = 'old'),
  2, '旧約を扱った Message は2（M1,M2）'
);
select is(
  (select (e ->> 'messages')::int from jsonb_array_elements((select j from an) -> 'testament') e
   where e ->> 'key' = 'new'),
  2, '新約を扱った Message は2（M1,M4）'
);
select is(
  (select (e ->> 'messages')::int from jsonb_array_elements((select j from an) -> 'genre') e
   where e ->> 'genre' = '公同書簡'),
  1, 'ジャンル「公同書簡」が1（一般書簡ではない）'
);
select is(
  (select (e ->> 'messages')::int from jsonb_array_elements((select j from an) -> 'genre') e
   where e ->> 'genre' = '福音書'),
  1, 'ジャンル「福音書」が1'
);
select is(
  (select (e ->> 'messages')::int from jsonb_array_elements((select j from an) -> 'books') e
   where e ->> 'book_id' = 'Heb'),
  1, '書巻 Heb が1'
);
select is(
  jsonb_array_length((select j from an) -> 'themes'),
  3, '主題は3種（M4 は主題なしで除外）'
);
select is(
  (select (e ->> 'messages')::int from jsonb_array_elements((select j from an) -> 'themes') e
   where e ->> 'theme' = '契約'),
  1, '主題「契約」が1'
);

-- 期間指定（6月）: M2 のみが対象
select is(
  (public.message_analytics(public.test_ws_a(), '2026-06-01', '2026-06-30') -> 'totals' ->> 'messages')::int,
  1, '期間（6月）で実施した Message は1（M2）'
);
select is(
  (public.message_analytics(public.test_ws_a(), '2026-06-01', '2026-06-30') -> 'totals' ->> 'deliveries')::int,
  1, '期間（6月）の Delivery は1'
);

-- 中止（canceled）の Gathering は実施回数にも期間 scope にも含めない。
-- M5（黙示録=新約）を6月の canceled 礼拝にだけ delivery しても、6月集計に混入しない。
insert into public.messages (id, workspace_id, type, title, metadata)
values ('a5000000-0000-0000-0000-000000000005', public.test_ws_a(), 'sermon', 'M5', '{}'::jsonb);
insert into public.message_passages (message_id, workspace_id, role, position, book_id, start_chapter, end_chapter, display_text)
values ('a5000000-0000-0000-0000-000000000005', public.test_ws_a(), 'primary', 1, 'Rev', 1, 1, '黙示録1');
insert into public.gatherings (id, workspace_id, title, kind, starts_at, status)
values ('b5000000-0000-0000-0000-000000000005', public.test_ws_a(), '6月(中止)', 'sunday_worship', '2026-06-20 10:30+09', 'canceled');
insert into public.message_deliveries (message_id, gathering_id, workspace_id)
values ('a5000000-0000-0000-0000-000000000005', 'b5000000-0000-0000-0000-000000000005', public.test_ws_a());

select is(
  (public.message_analytics(public.test_ws_a(), '2026-06-01', '2026-06-30') -> 'totals' ->> 'messages')::int,
  1, '中止礼拝にだけ delivery した Message は期間 scope に入らない（依然 M2 のみ）'
);
select is(
  (public.message_analytics(public.test_ws_a(), '2026-06-01', '2026-06-30') -> 'totals' ->> 'deliveries')::int,
  1, '中止礼拝の delivery は実施回数に数えない'
);

-- 越境: B（非メンバー）は A の集計を取得できない（RLS で scoped が空）
reset role;
insert into public.workspaces (id, name, slug)
values (gen_random_uuid(), 'Workspace B', 'workspace-b');
insert into public.workspace_members (workspace_id, user_id, role)
values ((select id from public.workspaces where slug = 'workspace-b'), '00000000-0000-0000-0000-00000000000b', 'owner');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select is(
  (public.message_analytics(public.test_ws_a()) -> 'totals' ->> 'messages')::int,
  0, '非メンバーは A の分析を取得できない（RLS）'
);

select * from finish();
rollback;
