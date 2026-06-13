-- E12（AI 支援の土台）: ai_suggestions の RLS と承認フローを検証する。
-- 不変条件:
--   - 認証ユーザーは status を勝手に変えられない（直接 update 権限なし）。
--   - 承認 RPC のみが pending→approved にし、その時だけ正本（messages）へ反映する。
--   - 承認/却下 RPC は DEFINER で RLS を迂回するため、非メンバー・不足ロールを
--     確実に拒否する（NULL 安全な権限チェック）。
--   - 同一 message・同一 kind の pending は1件まで（部分ユニーク索引）。
begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

-- A = owner、C = viewer、P = planner（いずれも A の member）、B = 非メンバー
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@test.local'),
  ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@test.local'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local');

create function public.test_ws_a()
returns uuid language sql stable security definer set search_path = ''
as $$ select id from public.workspaces where slug = 'workspace-a' $$;
grant execute on function public.test_ws_a() to authenticated;

create function public.test_msg_a()
returns uuid language sql stable security definer set search_path = ''
as $$ select id from public.messages
      where workspace_id = (select id from public.workspaces where slug = 'workspace-a')
        and title = 'AIテスト' limit 1 $$;
grant execute on function public.test_msg_a() to authenticated;

create function public.test_sug(p_kind text)
returns uuid language sql stable security definer set search_path = ''
as $$ select id from public.ai_suggestions
      where workspace_id = (select id from public.workspaces where slug = 'workspace-a')
        and kind = p_kind limit 1 $$;
grant execute on function public.test_sug(text) to authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok($$ select public.create_workspace('Workspace A', 'workspace-a') $$, 'workspace A 作成');
select lives_ok(
  $$ insert into public.messages (workspace_id, title) values (public.test_ws_a(), 'AIテスト') $$,
  'owner は message を作成できる'
);

-- C=viewer, P=planner を A の active member として追加（superuser）
reset role;
insert into public.workspace_members (workspace_id, user_id, role, status)
values
  ((select id from public.workspaces where slug = 'workspace-a'), '00000000-0000-0000-0000-00000000000c', 'viewer', 'active'),
  ((select id from public.workspaces where slug = 'workspace-a'), '00000000-0000-0000-0000-00000000000d', 'planner', 'active');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

-- owner は pending 提案を作成できる
select lives_ok(
  $$ insert into public.ai_suggestions (workspace_id, message_id, kind, content)
     values (public.test_ws_a(), public.test_msg_a(), 'summary', 'AIが作った概要') $$,
  'owner は pending 提案を作成できる'
);

-- 同一 message・同一 kind の pending は1件まで（部分ユニーク索引）
select throws_ok(
  $$ insert into public.ai_suggestions (workspace_id, message_id, kind, content)
     values (public.test_ws_a(), public.test_msg_a(), 'summary', '二つ目の概要') $$,
  '23505', null, '同一 kind の pending を重複作成できない'
);

-- approved を指定して挿入しても trigger が pending へ正規化する（多層防御）
select lives_ok(
  $$ insert into public.ai_suggestions (workspace_id, message_id, kind, content, status)
     values (public.test_ws_a(), public.test_msg_a(), 'central_message', '神は真実である', 'approved') $$,
  'approved 指定でも作成自体は通る'
);
select is(
  (select status from public.ai_suggestions where kind = 'central_message'),
  'pending', '作成時の status は pending に正規化される'
);

-- viewer / planner は提案を作成できない（owner/pastor のみ）
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';
select throws_ok(
  $$ insert into public.ai_suggestions (workspace_id, message_id, kind, content)
     values (public.test_ws_a(), public.test_msg_a(), 'summary', 'viewerの提案') $$,
  '42501', null, 'viewer は提案を作成できない'
);
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000d", "role": "authenticated"}';
select throws_ok(
  $$ insert into public.ai_suggestions (workspace_id, message_id, kind, content)
     values (public.test_ws_a(), public.test_msg_a(), 'summary', 'plannerの提案') $$,
  '42501', null, 'planner は提案を作成できない'
);

-- member（viewer）は閲覧できる
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';
select is(
  (select count(*)::int from public.ai_suggestions where workspace_id = public.test_ws_a()),
  2, 'member は提案を閲覧できる'
);

-- viewer は承認できない（insufficient role）
select throws_ok(
  $$ select public.approve_ai_suggestion(public.test_sug('summary')) $$,
  '42501', 'insufficient role', 'viewer は承認できない'
);

-- 非メンバー B は承認・却下できない（DEFINER で RLS を迂回するため NULL 安全な権限チェックが要）
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select throws_ok(
  $$ select public.approve_ai_suggestion(public.test_sug('summary')) $$,
  '42501', 'insufficient role', '非メンバーは承認できない（越境承認の防止）'
);
select throws_ok(
  $$ select public.reject_ai_suggestion(public.test_sug('central_message')) $$,
  '42501', 'insufficient role', '非メンバーは却下できない'
);

-- owner でも直接 update はできない（status 改ざん防止＝update 権限なし）
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select throws_ok(
  $$ update public.ai_suggestions set status = 'approved' where workspace_id = public.test_ws_a() $$,
  '42501', null, '認証ユーザーは status を直接変更できない'
);

-- owner は承認でき、正本へ反映される
select lives_ok(
  $$ select public.approve_ai_suggestion(public.test_sug('summary')) $$,
  'owner は承認できる'
);
select is(
  (select summary from public.messages where id = public.test_msg_a()),
  'AIが作った概要', '承認で正本（summary）へ反映される'
);
select is(
  (select status from public.ai_suggestions where kind = 'summary'),
  'approved', '承認で提案が approved になる'
);

-- 承認済みは再承認できない
select throws_ok(
  $$ select public.approve_ai_suggestion(public.test_sug('summary')) $$,
  'P0001', 'suggestion is not pending', '承認済みは再承認できない'
);

-- 却下は正本へ触れない
select lives_ok(
  $$ select public.reject_ai_suggestion(public.test_sug('central_message')) $$,
  'owner は却下できる'
);
select is(
  (select status from public.ai_suggestions where kind = 'central_message'),
  'rejected', '却下で rejected になる'
);
select is(
  (select central_message from public.messages where id = public.test_msg_a()),
  '', '却下では正本（central_message）へ反映されない'
);

-- 非メンバー B は他 workspace の提案を閲覧できない
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select is(
  (select count(*)::int from public.ai_suggestions where workspace_id = public.test_ws_a()),
  0, '非メンバーは他 workspace の提案を閲覧できない'
);

select * from finish();
rollback;
