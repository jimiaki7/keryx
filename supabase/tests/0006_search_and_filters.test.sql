-- KX-022: search_messages / saved_filters の検証
begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

-- A = owner（workspace-a）、B = workspace-b の member（越境確認用）
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

-- 種データ: series / venue / 3 messages / passages / gatherings / deliveries
insert into public.series (id, workspace_id, name)
values ('d1111111-1111-1111-1111-111111111111', public.test_ws_a(), '創世記講解');

insert into public.venues (id, workspace_id, name)
values ('c1111111-1111-1111-1111-111111111111', public.test_ws_a(), '本会堂');

insert into public.messages (id, workspace_id, type, title, central_message, status, primary_series_id, metadata)
values
  ('a1111111-1111-1111-1111-111111111111', public.test_ws_a(), 'sermon', '初めに神が', '神は世を愛された',
   'completed', 'd1111111-1111-1111-1111-111111111111', '{"legacy": {"theme": "神"}}'::jsonb),
  ('a2222222-2222-2222-2222-222222222222', public.test_ws_a(), 'prayer_meeting_exhortation', '幸いな人の道', '',
   'preparing', null, '{"legacy": {"theme": "祈り"}}'::jsonb),
  ('a3333333-3333-3333-3333-333333333333', public.test_ws_a(), 'sermon', 'メモだけ', '',
   'planned', null, '{}'::jsonb);

insert into public.message_passages (message_id, workspace_id, role, position, book_id, start_chapter, start_verse, end_chapter, end_verse, display_text)
values
  ('a1111111-1111-1111-1111-111111111111', public.test_ws_a(), 'primary', 1, 'Gen', 1, 1, 1, 5, '創世記1:1-5'),
  ('a2222222-2222-2222-2222-222222222222', public.test_ws_a(), 'primary', 1, 'Ps', 1, 1, 1, 6, '詩篇1:1-6');

insert into public.gatherings (id, workspace_id, title, kind, starts_at, venue_id)
values
  ('b1111111-1111-1111-1111-111111111111', public.test_ws_a(), '主日礼拝', 'sunday_worship', '2026-01-04 10:30+09', 'c1111111-1111-1111-1111-111111111111'),
  ('b2222222-2222-2222-2222-222222222222', public.test_ws_a(), '祈祷会', 'prayer_meeting', '2026-06-10 19:30+09', null);

insert into public.message_deliveries (message_id, gathering_id, workspace_id, speaker_name)
values
  ('a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', public.test_ws_a(), 'Jimi'),
  ('a2222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', public.test_ws_a(), 'ゲスト');

-- ---------------------------------------------------------------------------
-- 自由文検索（タイトル / 聖書箇所 / 中心メッセージ / 主題）
-- ---------------------------------------------------------------------------
select is(
  (select title from public.search_messages(public.test_ws_a(), '初めに')),
  '初めに神が', 'タイトル部分一致'
);
select is(
  (select title from public.search_messages(public.test_ws_a(), '詩篇')),
  '幸いな人の道', '聖書箇所表示の部分一致'
);
select is(
  (select title from public.search_messages(public.test_ws_a(), '世を愛')),
  '初めに神が', '中心メッセージの部分一致'
);
select is(
  (select title from public.search_messages(public.test_ws_a(), '祈り')),
  '幸いな人の道', '主題（legacy.theme）の部分一致'
);

-- ---------------------------------------------------------------------------
-- 関連テーブル絞り込み（series / venue / speaker / status / type / date）
-- ---------------------------------------------------------------------------
select is(
  (select title from public.search_messages(public.test_ws_a(), null, 'd1111111-1111-1111-1111-111111111111')),
  '初めに神が', 'シリーズ絞り込み'
);
select is(
  (select title from public.search_messages(public.test_ws_a(), null, null, '本会堂')),
  '初めに神が', '会場絞り込み（delivery→gathering→venue）'
);
select is(
  (select title from public.search_messages(public.test_ws_a(), null, null, null, 'ゲスト')),
  '幸いな人の道', '説教者絞り込み'
);
select is(
  (select title from public.search_messages(public.test_ws_a(), null, null, null, null, 'completed')),
  '初めに神が', '状態絞り込み'
);
select is(
  (select title from public.search_messages(public.test_ws_a(), null, null, null, null, null, 'prayer_meeting_exhortation')),
  '幸いな人の道', '種別絞り込み'
);
select is(
  (select title from public.search_messages(public.test_ws_a(), null, null, null, null, null, null, '2026-06-01')),
  '幸いな人の道', '開始日 from（Tokyo 暦日）で絞り込み'
);
select is(
  (select title from public.search_messages(public.test_ws_a(), null, null, null, null, null, null, null, '2026-03-01')),
  '初めに神が', '開始日 to で絞り込み'
);

-- ---------------------------------------------------------------------------
-- フィルター無しは全件（draft 含む）、件数と passages 形
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from public.search_messages(public.test_ws_a())),
  3, 'フィルター無しは draft 含め全件（3）'
);
select is(
  (select passages -> 0 ->> 'display_text'
   from public.search_messages(public.test_ws_a(), '初めに')),
  '創世記1:1-5', 'passages に聖書箇所が入る'
);
select is(
  (select distinct total_count::int from public.search_messages(public.test_ws_a())),
  3, 'total_count に LIMIT 前の総数が入る'
);

-- ---------------------------------------------------------------------------
-- 日付 from/to の組み合わせ: 同一 delivery が範囲内にあることを要求する。
-- 1月と12月に語った（6月には無い）説教は、6月の範囲指定で除外される。
-- ---------------------------------------------------------------------------
insert into public.messages (id, workspace_id, type, title, status)
values ('a4444444-4444-4444-4444-444444444444', public.test_ws_a(), 'sermon', '二度語った説教', 'completed');
insert into public.gatherings (id, workspace_id, title, kind, starts_at)
values
  ('b3111111-1111-1111-1111-111111111111', public.test_ws_a(), '1月', 'sunday_worship', '2026-01-11 10:30+09'),
  ('b3222222-2222-2222-2222-222222222222', public.test_ws_a(), '12月', 'sunday_worship', '2026-12-20 10:30+09');
insert into public.message_deliveries (message_id, gathering_id, workspace_id)
values
  ('a4444444-4444-4444-4444-444444444444', 'b3111111-1111-1111-1111-111111111111', public.test_ws_a()),
  ('a4444444-4444-4444-4444-444444444444', 'b3222222-2222-2222-2222-222222222222', public.test_ws_a());

select is(
  (select count(*)::int from public.search_messages(
     public.test_ws_a(), null, null, null, null, null, null, '2026-06-01', '2026-06-30')
   where title = '二度語った説教'),
  0, '範囲外の2 delivery を持つ説教は from+to 範囲（6月）で誤一致しない'
);
select is(
  (select count(*)::int from public.search_messages(
     public.test_ws_a(), null, null, null, null, null, null, '2026-01-01', '2026-12-31')
   where title = '二度語った説教'),
  1, '年間範囲なら二度語った説教は一致する（同一 delivery が両端を満たす）'
);
select is(
  (select count(*)::int from public.search_messages(
     public.test_ws_a(), null, null, null, null, null, null, '2026-07-01', '2026-03-01')),
  0, '逆転範囲（from > to）は全件空になる'
);

-- ---------------------------------------------------------------------------
-- saved_filters: 本人のみ
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.saved_filters (workspace_id, user_id, name, params)
     values (public.test_ws_a(), '00000000-0000-0000-0000-00000000000a', '神の主題', '{"q": "神"}'::jsonb) $$,
  '本人の保存フィルターを作成できる'
);
select is(
  (select count(*)::int from public.saved_filters where workspace_id = public.test_ws_a()),
  1, '本人は自分の保存フィルターを見られる'
);
select throws_ok(
  $$ insert into public.saved_filters (workspace_id, user_id, name, params)
     values (public.test_ws_a(), '00000000-0000-0000-0000-00000000000a', '非オブジェクト', '"x"'::jsonb) $$,
  '23514', null, 'params がオブジェクトでなければ check 制約で拒否される'
);
select throws_ok(
  $$ insert into public.saved_filters (workspace_id, user_id, name, params)
     values (public.test_ws_a(), '00000000-0000-0000-0000-00000000000b', 'なりすまし', '{}'::jsonb) $$,
  '42501', null, '他ユーザー名義の保存フィルターは作れない'
);

-- ---------------------------------------------------------------------------
-- 越境: B（workspace-a の非メンバー）は A のデータを検索・閲覧できない
-- ---------------------------------------------------------------------------
reset role;
insert into public.workspaces (id, name, slug)
values (gen_random_uuid(), 'Workspace B', 'workspace-b');
insert into public.workspace_members (workspace_id, user_id, role)
values ((select id from public.workspaces where slug = 'workspace-b'), '00000000-0000-0000-0000-00000000000b', 'owner');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select is(
  (select count(*)::int from public.search_messages(public.test_ws_a())),
  0, '非メンバーは search_messages で A の行を取得できない（RLS）'
);
select is(
  (select count(*)::int from public.saved_filters where workspace_id = public.test_ws_a()),
  0, '非メンバーは A の保存フィルターを閲覧できない'
);

select * from finish();
rollback;
