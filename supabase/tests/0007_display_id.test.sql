-- next_display_id の桁あふれ衝突修正の回帰テスト（messages / gatherings 共用）
begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

-- postgres ロールのまま（RLS 迂回。before-insert トリガー経由で next_display_id の整形を検証）
insert into public.workspaces (id, name, slug)
values ('000000dd-0000-0000-0000-0000000000dd', 'DisplayID', 't-did');

-- カウンタ行を作るため1件 insert（counter=1 → 0001。従来どおりのゼロ詰め）
insert into public.messages (workspace_id, title)
values ('000000dd-0000-0000-0000-0000000000dd', 'first');

select is(
  (select display_id from public.messages
    where workspace_id = '000000dd-0000-0000-0000-0000000000dd' and title = 'first'),
  'MSG-' || extract(year from now())::int || '-0001',
  '小さい番号は従来どおり4桁ゼロ詰め（0001）'
);

-- 旧バグの境界（counter=10000 で '1000' へ切り詰め）の直前までカウンタを進める
update public.display_id_counters
  set counter = 9998
  where workspace_id = '000000dd-0000-0000-0000-0000000000dd'
    and entity = 'message' and year = extract(year from now())::int;

insert into public.messages (workspace_id, title) values
  ('000000dd-0000-0000-0000-0000000000dd', 'at9999'),
  ('000000dd-0000-0000-0000-0000000000dd', 'at10000'),
  ('000000dd-0000-0000-0000-0000000000dd', 'at10001');

select is(
  (select display_id from public.messages
    where workspace_id = '000000dd-0000-0000-0000-0000000000dd' and title = 'at9999'),
  'MSG-' || extract(year from now())::int || '-9999', '9999 は4桁ゼロ詰め'
);
select is(
  (select display_id from public.messages
    where workspace_id = '000000dd-0000-0000-0000-0000000000dd' and title = 'at10000'),
  'MSG-' || extract(year from now())::int || '-10000',
  '10000 は切り詰めず5桁（旧バグでは 1000 に衝突していた）'
);
select is(
  (select display_id from public.messages
    where workspace_id = '000000dd-0000-0000-0000-0000000000dd' and title = 'at10001'),
  'MSG-' || extract(year from now())::int || '-10001', '10001 は5桁'
);
select is(
  (select count(*)::int from (
     select display_id from public.messages
     where workspace_id = '000000dd-0000-0000-0000-0000000000dd'
     group by display_id having count(*) > 1) d),
  0, '同一 workspace/year で message の display_id に重複が無い'
);

-- gatherings も同じ next_display_id を共用するので境界を1点確認する
insert into public.gatherings (workspace_id, title, starts_at)
values ('000000dd-0000-0000-0000-0000000000dd', 'gfirst', '2026-01-04 10:30+09');
update public.display_id_counters
  set counter = 9999
  where workspace_id = '000000dd-0000-0000-0000-0000000000dd'
    and entity = 'gathering' and year = extract(year from now())::int;
insert into public.gatherings (workspace_id, title, starts_at)
values ('000000dd-0000-0000-0000-0000000000dd', 'g10000', '2026-01-04 10:30+09');

select is(
  (select display_id from public.gatherings
    where workspace_id = '000000dd-0000-0000-0000-0000000000dd' and title = 'g10000'),
  'GTH-' || extract(year from now())::int || '-10000', 'gathering も 10000 で切り詰めず5桁'
);

select * from finish();
rollback;
