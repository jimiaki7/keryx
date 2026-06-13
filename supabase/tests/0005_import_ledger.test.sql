-- KX-021: import_ledger_batch / undo_import_batch（トランザクショナル取り込み）の検証
begin;

create extension if not exists pgtap with schema extensions;

select plan(30);

-- テストユーザー: A = owner、B = 非メンバー、C = viewer、E = planner
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user-b@test.local'),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user-c@test.local'),
  ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user-e@test.local');

create function public.test_ws_a()
returns uuid language sql stable security definer set search_path = ''
as $$ select id from public.workspaces where slug = 'workspace-a' $$;
grant execute on function public.test_ws_a() to authenticated;

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

-- ---------------------------------------------------------------------------
-- 取り込みペイロード: 行6（主日礼拝・過去日・聖書箇所/シリーズ/会場/聖餐式）、
-- 行7（祈祷会・未来日）、行8（行6と同一 legacy_id/fingerprint のファイル内重複）
-- ---------------------------------------------------------------------------
create temp table r1 as
select public.import_ledger_batch(
  public.test_ws_a(), 'plan.xlsx',
  '11111111-1111-1111-1111-111111111111'::uuid,
  $json$[
    {
      "row_number": 6, "fingerprint": "fp-6", "legacy_id": "S-20260104-01",
      "type": "sermon", "status": "completed", "preparation_stage": "completed",
      "title": "初めに神が", "central_message": "神は世を愛された", "notes": "導入の例話",
      "kind": "sunday_worship", "gathering_title": "", "starts_at": "2026-01-04T10:30:00+09:00",
      "speaker": "Jimi", "venue": "本会堂", "series_name": "創世記講解", "series_number": 1,
      "passage": {"book_id": "Gen", "start_chapter": 1, "start_verse": 1, "end_chapter": 1, "end_verse": 5, "display_text": "創世記1:1-5"},
      "elements": [
        {"type": "scripture_reading", "title": "創世記1:1-5"},
        {"type": "message", "title": ""},
        {"type": "ceremony", "title": "", "ceremony_type": "communion"},
        {"type": "doxology", "title": "頌栄"}
      ],
      "legacy": {"observance": "", "theme": "神", "tags": ["創造"], "next_action": "", "due_on": "", "manuscript_ref": ""},
      "migration_notes": []
    },
    {
      "row_number": 7, "fingerprint": "fp-7", "legacy_id": "P-20261230-01",
      "type": "prayer_meeting_exhortation", "status": "preparing", "preparation_stage": "exegesis",
      "title": "目を覚まして", "central_message": "", "notes": "",
      "kind": "prayer_meeting", "gathering_title": "", "starts_at": "2026-12-30T19:30:00+09:00",
      "speaker": "", "venue": "", "series_name": "", "series_number": null,
      "passage": {"book_id": "Ps", "start_chapter": 1, "start_verse": 1, "end_chapter": 1, "end_verse": 6, "display_text": "詩篇1:1-6"},
      "elements": [{"type": "message", "title": ""}],
      "legacy": {"observance": "", "theme": "", "tags": [], "next_action": "", "due_on": "", "manuscript_ref": ""},
      "migration_notes": []
    },
    {
      "row_number": 8, "fingerprint": "fp-6", "legacy_id": "S-20260104-01",
      "type": "sermon", "status": "completed", "preparation_stage": "completed",
      "title": "初めに神が（重複）", "central_message": "", "notes": "",
      "kind": "sunday_worship", "gathering_title": "", "starts_at": "2026-01-04T10:30:00+09:00",
      "speaker": "", "venue": "", "series_name": "", "series_number": null,
      "passage": null, "elements": [{"type": "message", "title": ""}],
      "legacy": {"observance": "", "theme": "", "tags": [], "next_action": "", "due_on": "", "manuscript_ref": ""},
      "migration_notes": []
    }
  ]$json$::jsonb
) as res;

select is((select jsonb_array_length(res)::int from r1), 3, '3 行が処理される');
select is(
  (select count(*)::int from jsonb_array_elements((select res from r1)) e where e ->> 'status' = 'created'),
  2, '2 行が作成される（行6・行7）'
);
select is(
  (select count(*)::int from jsonb_array_elements((select res from r1)) e where e ->> 'status' = 'skipped'),
  1, 'ファイル内重複（行8）はスキップされる'
);

select is(
  (select count(*)::int from public.messages where workspace_id = public.test_ws_a() and deleted_at is null),
  2, 'messages が2件作成される'
);
select is(
  (select count(*)::int from public.gatherings where workspace_id = public.test_ws_a() and deleted_at is null),
  2, 'gatherings が2件作成される'
);
select is(
  (select count(*)::int from public.message_deliveries where workspace_id = public.test_ws_a()),
  2, 'message_deliveries が2件作成される'
);
select is(
  (select count(*)::int from public.message_passages where workspace_id = public.test_ws_a()),
  2, 'message_passages が2件作成される'
);
select is(
  (select count(*)::int from public.series where workspace_id = public.test_ws_a() and deleted_at is null),
  1, 'series が1件（創世記講解）作成される'
);
select is(
  (select count(*)::int from public.series_messages where workspace_id = public.test_ws_a()),
  1, 'series_messages が1件作成される'
);
select is(
  (select count(*)::int from public.venues where workspace_id = public.test_ws_a() and deleted_at is null),
  1, 'venues が1件（本会堂）作成される'
);
select is(
  (select count(*)::int from public.service_elements where workspace_id = public.test_ws_a()),
  5, 'service_elements が5件作成される（行6:4 + 行7:1）'
);
select is(
  (select count(*)::int from public.gatherings
    where workspace_id = public.test_ws_a() and deleted_at is null and status = 'completed'),
  1, '過去日の Gathering は completed になる'
);
select is(
  (select count(*)::int from public.gatherings
    where workspace_id = public.test_ws_a() and deleted_at is null and status = 'scheduled'),
  1, '未来日の Gathering は scheduled になる'
);
select is(
  (select m.metadata ->> 'legacy_id' from public.messages m
    where m.workspace_id = public.test_ws_a() and m.metadata ->> 'legacy_id' = 'S-20260104-01'),
  'S-20260104-01', 'metadata.legacy_id が保持される'
);
select is(
  (select m.metadata -> 'import' ->> 'fingerprint' from public.messages m
    where m.workspace_id = public.test_ws_a() and m.metadata ->> 'legacy_id' = 'S-20260104-01'),
  'fp-6', 'metadata.import.fingerprint が保持される'
);

-- ---------------------------------------------------------------------------
-- 再実行安全性: 同じ行を別バッチで再投入しても、すべてスキップされ重複を作らない
-- ---------------------------------------------------------------------------
create temp table r2 as
select public.import_ledger_batch(
  public.test_ws_a(), 'plan.xlsx',
  '22222222-2222-2222-2222-222222222222'::uuid,
  $json$[
    {"row_number": 6, "fingerprint": "fp-6", "legacy_id": "S-20260104-01", "type": "sermon", "status": "completed", "preparation_stage": "completed", "title": "初めに神が", "central_message": "", "notes": "", "kind": "sunday_worship", "gathering_title": "", "starts_at": "2026-01-04T10:30:00+09:00", "speaker": "", "venue": "", "series_name": "", "series_number": null, "passage": null, "elements": [], "legacy": {}, "migration_notes": []},
    {"row_number": 7, "fingerprint": "fp-7", "legacy_id": "P-20261230-01", "type": "prayer_meeting_exhortation", "status": "preparing", "preparation_stage": "exegesis", "title": "目を覚まして", "central_message": "", "notes": "", "kind": "prayer_meeting", "gathering_title": "", "starts_at": "2026-12-30T19:30:00+09:00", "speaker": "", "venue": "", "series_name": "", "series_number": null, "passage": null, "elements": [], "legacy": {}, "migration_notes": []}
  ]$json$::jsonb
) as res;

select is(
  (select count(*)::int from jsonb_array_elements((select res from r2)) e where e ->> 'status' = 'skipped'),
  2, '再実行ではすべてスキップされる（冪等）'
);
select is(
  (select count(*)::int from public.messages where workspace_id = public.test_ws_a() and deleted_at is null),
  2, '再実行後も messages は2件のまま（重複なし）'
);

-- ---------------------------------------------------------------------------
-- §5: 同じ説教を同日に別会場で語った行（fingerprint 一致・legacy_id 別）は
-- 取りこぼさず両方作成する（fingerprint だけで自動スキップしない）
-- ---------------------------------------------------------------------------
create temp table r3 as
select public.import_ledger_batch(
  public.test_ws_a(), 'plan.xlsx',
  '33333333-3333-3333-3333-333333333333'::uuid,
  $json$[
    {"row_number": 20, "fingerprint": "fp-same", "legacy_id": "S-20270104-01", "type": "sermon", "status": "planned", "preparation_stage": "not_started", "title": "同じ説教", "central_message": "", "notes": "", "kind": "sunday_worship", "gathering_title": "", "starts_at": "2027-01-04T10:30:00+09:00", "speaker": "", "venue": "本会堂", "series_name": "", "series_number": null, "passage": null, "elements": [], "legacy": {}, "migration_notes": []},
    {"row_number": 21, "fingerprint": "fp-same", "legacy_id": "S-20270104-02", "type": "sermon", "status": "planned", "preparation_stage": "not_started", "title": "同じ説教", "central_message": "", "notes": "", "kind": "sunday_worship", "gathering_title": "", "starts_at": "2027-01-04T14:00:00+09:00", "speaker": "", "venue": "別会場", "series_name": "", "series_number": null, "passage": null, "elements": [], "legacy": {}, "migration_notes": []}
  ]$json$::jsonb
) as res;

select is(
  (select count(*)::int from jsonb_array_elements((select res from r3)) e where e ->> 'status' = 'created'),
  2, 'fingerprint 一致でも legacy_id が異なれば両方作成される（§5(2)/(3)）'
);
select is(
  (select count(*)::int from public.messages where workspace_id = public.test_ws_a() and deleted_at is null),
  4, '同日別会場の2件が加わり messages は4件になる'
);

-- ---------------------------------------------------------------------------
-- データ起因のエラー（無効な book_id）は当該行だけを error にし、他行は作成する
-- （systemic でない 23xxx はバッチ全体を失敗させない）
-- ---------------------------------------------------------------------------
create temp table r4 as
select public.import_ledger_batch(
  public.test_ws_a(), 'plan.xlsx',
  '44444444-4444-4444-4444-444444444444'::uuid,
  $json$[
    {"row_number": 30, "fingerprint": "fp-ok", "legacy_id": "S-20270201-01", "type": "sermon", "status": "planned", "preparation_stage": "not_started", "title": "正常行", "central_message": "", "notes": "", "kind": "sunday_worship", "gathering_title": "", "starts_at": "2027-02-01T10:30:00+09:00", "speaker": "", "venue": "", "series_name": "", "series_number": null, "passage": null, "elements": [], "legacy": {}, "migration_notes": []},
    {"row_number": 31, "fingerprint": "fp-bad", "legacy_id": "S-20270208-01", "type": "sermon", "status": "planned", "preparation_stage": "not_started", "title": "不正書巻", "central_message": "", "notes": "", "kind": "sunday_worship", "gathering_title": "", "starts_at": "2027-02-08T10:30:00+09:00", "speaker": "", "venue": "", "series_name": "", "series_number": null, "passage": {"book_id": "ZZZ", "start_chapter": 1, "start_verse": 1, "end_chapter": 1, "end_verse": 1, "display_text": "不正"}, "elements": [], "legacy": {}, "migration_notes": []}
  ]$json$::jsonb
) as res;

select is(
  (select e ->> 'status' from jsonb_array_elements((select res from r4)) e where (e ->> 'row_number')::int = 31),
  'error', '無効な book_id の行は error になる（FK 23503 を行エラーに降格）'
);
select is(
  (select e ->> 'status' from jsonb_array_elements((select res from r4)) e where (e ->> 'row_number')::int = 30),
  'created', '同じバッチの正常行は作成される（バッチ全体は失敗しない）'
);
select is(
  (select count(*)::int from public.messages where workspace_id = public.test_ws_a() and deleted_at is null),
  5, '正常行のみ加わり messages は5件になる'
);

-- ---------------------------------------------------------------------------
-- バッチ取り消し（ソフトデリート）。batch1（行6・行7）だけを消す
-- ---------------------------------------------------------------------------
select is(
  public.undo_import_batch(public.test_ws_a(), '11111111-1111-1111-1111-111111111111'::uuid),
  2, 'undo はバッチ内の messages を2件ソフトデリートする'
);
select is(
  (select count(*)::int from public.messages
    where workspace_id = public.test_ws_a() and deleted_at is null
      and metadata -> 'import' ->> 'batch_id' = '11111111-1111-1111-1111-111111111111'),
  0, 'undo 後そのバッチの messages は残らない'
);
select is(
  (select count(*)::int from public.gatherings
    where workspace_id = public.test_ws_a() and deleted_at is null
      and metadata -> 'import' ->> 'batch_id' = '11111111-1111-1111-1111-111111111111'),
  0, 'undo 後そのバッチの gatherings も残らない'
);
select is(
  (select count(*)::int from public.messages where workspace_id = public.test_ws_a() and deleted_at is null),
  3, 'undo は他バッチ（同日別会場2件＋正常1件）を巻き込まない'
);

-- ---------------------------------------------------------------------------
-- 認可: owner/pastor 以外は取り込めない
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000e", "role": "authenticated"}';
select throws_ok(
  $$ select public.import_ledger_batch(public.test_ws_a(), 'f', gen_random_uuid(), '[]'::jsonb) $$,
  'P0001', 'insufficient privileges to import into this workspace',
  'planner は取り込めない'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';
select throws_ok(
  $$ select public.import_ledger_batch(public.test_ws_a(), 'f', gen_random_uuid(), '[]'::jsonb) $$,
  'P0001', 'insufficient privileges to import into this workspace',
  'viewer は取り込めない'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select throws_ok(
  $$ select public.import_ledger_batch(public.test_ws_a(), 'f', gen_random_uuid(), '[]'::jsonb) $$,
  'P0001', 'insufficient privileges to import into this workspace',
  '非メンバーは取り込めない'
);

select * from finish();
rollback;
