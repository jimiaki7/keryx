-- KX-007: Message schema・RLS・監査イベント・表示ID
-- KX-005: bible_books マスタ（seed は本ファイル末尾。packages/scripture が正本で、
--         scripts/gen-bible-books-sql.ts で再生成する）

-- ---------------------------------------------------------------------------
-- bible_books（読み取り専用マスタ）
-- ---------------------------------------------------------------------------
create table public.bible_books (
  osis text primary key,
  canonical_order smallint not null unique,
  testament text not null check (testament in ('old', 'new')),
  genre text not null,
  name_ja text not null,
  short_name_ja text not null,
  name_en text not null,
  aliases jsonb not null default '[]'::jsonb,
  chapter_count smallint not null check (chapter_count between 1 and 150)
);

alter table public.bible_books enable row level security;
revoke all on public.bible_books from anon, authenticated;
grant select on public.bible_books to authenticated;
grant all on public.bible_books to service_role;

create policy bible_books_select_authenticated on public.bible_books
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 表示ID採番（Workspace × エンティティ × 年ごとの連番。例: MSG-2026-0042）
-- ---------------------------------------------------------------------------
create table public.display_id_counters (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  entity text not null,
  year integer not null,
  counter integer not null default 0,
  primary key (workspace_id, entity, year)
);

-- ユーザーが直接触るテーブルではない（security definer 関数のみが更新する）
alter table public.display_id_counters enable row level security;
revoke all on public.display_id_counters from anon, authenticated;
grant all on public.display_id_counters to service_role;

create function public.next_display_id(target_workspace uuid, entity_name text, prefix text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  y integer := extract(year from now())::integer;
  n integer;
begin
  insert into public.display_id_counters as c (workspace_id, entity, year, counter)
  values (target_workspace, entity_name, y, 1)
  on conflict (workspace_id, entity, year)
  do update set counter = c.counter + 1
  returning counter into n;
  return prefix || '-' || y || '-' || lpad(n::text, 4, '0');
end;
$$;

revoke execute on function public.next_display_id(uuid, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- messages（語る内容。日付・会場・説教者・礼拝順序は持たない）
-- ---------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  display_id text not null default '',
  type text not null default 'sermon'
    check (type in ('sermon', 'prayer_meeting_exhortation', 'devotional', 'lecture', 'other')),
  title text not null default '',
  central_message text not null default '',
  summary text not null default '',
  outline_markdown text not null default '',
  notes_markdown text not null default '',
  status text not null default 'inbox'
    check (status in ('inbox', 'planned', 'preparing', 'ready', 'completed', 'archived')),
  source_links jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  version integer not null default 1,
  unique (workspace_id, display_id)
);

create index messages_workspace_status_idx
  on public.messages (workspace_id, status)
  where deleted_at is null;

create function public.messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.display_id is null or new.display_id = '' then
    new.display_id := public.next_display_id(new.workspace_id, 'message', 'MSG');
  end if;
  new.created_by := coalesce(new.created_by, (select auth.uid()));
  new.updated_by := coalesce(new.updated_by, (select auth.uid()));
  return new;
end;
$$;

create function public.messages_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  return new;
end;
$$;

create trigger messages_before_insert
  before insert on public.messages
  for each row execute function public.messages_before_insert();

create trigger messages_before_update
  before update on public.messages
  for each row execute function public.messages_before_update();

-- RLS: 閲覧は active member、書き込みは owner / pastor。
-- ハード DELETE はポリシーを定義しない（ソフトデリートのみ）。
-- TODO(KX-0xx): planner / viewer に対する notes_markdown の秘匿は Message privacy 設計時に扱う。
alter table public.messages enable row level security;
revoke all on public.messages from anon;
grant select, insert, update on public.messages to authenticated;
grant all on public.messages to service_role;

create policy messages_select_member on public.messages
  for select using (public.is_active_member(workspace_id));
create policy messages_insert_writer on public.messages
  for insert with check (public.member_role(workspace_id) in ('owner', 'pastor'));
create policy messages_update_writer on public.messages
  for update using (public.member_role(workspace_id) in ('owner', 'pastor'))
  with check (public.member_role(workspace_id) in ('owner', 'pastor'));

-- ---------------------------------------------------------------------------
-- message_passages（構造化された聖書箇所）
-- ---------------------------------------------------------------------------
create table public.message_passages (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  role text not null default 'primary' check (role in ('primary', 'supporting')),
  position numeric not null default 1,
  book_id text not null references public.bible_books (osis),
  start_chapter smallint not null check (start_chapter >= 1),
  start_verse smallint check (start_verse >= 1),
  end_chapter smallint not null check (end_chapter >= 1),
  end_verse smallint check (end_verse >= 1),
  display_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_chapter >= start_chapter)
);

create index message_passages_message_idx on public.message_passages (message_id);
create index message_passages_book_idx on public.message_passages (workspace_id, book_id);

create trigger message_passages_set_updated_at
  before update on public.message_passages
  for each row execute function public.set_updated_at();

alter table public.message_passages enable row level security;
revoke all on public.message_passages from anon;
grant select, insert, update, delete on public.message_passages to authenticated;
grant all on public.message_passages to service_role;

create policy message_passages_select_member on public.message_passages
  for select using (public.is_active_member(workspace_id));
create policy message_passages_insert_writer on public.message_passages
  for insert with check (
    public.member_role(workspace_id) in ('owner', 'pastor')
    and exists (
      select 1 from public.messages m
      where m.id = message_id and m.workspace_id = message_passages.workspace_id
    )
  );
create policy message_passages_update_writer on public.message_passages
  for update using (public.member_role(workspace_id) in ('owner', 'pastor'))
  with check (
    public.member_role(workspace_id) in ('owner', 'pastor')
    and exists (
      select 1 from public.messages m
      where m.id = message_id and m.workspace_id = message_passages.workspace_id
    )
  );
create policy message_passages_delete_writer on public.message_passages
  for delete using (public.member_role(workspace_id) in ('owner', 'pastor'));

-- ---------------------------------------------------------------------------
-- audit_events（重要操作の監査。本文は複製しない）
-- ---------------------------------------------------------------------------
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_id uuid,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  summary text not null default '',
  changed_fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_workspace_idx on public.audit_events (workspace_id, created_at desc);

-- ユーザーは閲覧のみ。書き込みは trigger（security definer）経由のみ。
alter table public.audit_events enable row level security;
revoke all on public.audit_events from anon, authenticated;
grant select on public.audit_events to authenticated;
grant all on public.audit_events to service_role;

create policy audit_events_select_member on public.audit_events
  for select using (public.is_active_member(workspace_id));

create function public.audit_message_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  act text;
  changed jsonb := '[]'::jsonb;
begin
  if tg_op = 'INSERT' then
    act := 'create';
  else
    if old.deleted_at is null and new.deleted_at is not null then
      act := 'soft_delete';
    elsif old.deleted_at is not null and new.deleted_at is null then
      act := 'restore';
    else
      act := 'update';
    end if;
    select coalesce(jsonb_agg(d.key), '[]'::jsonb) into changed
    from (
      select n.key
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o on o.key = n.key
      where n.value is distinct from o.value
        and n.key not in ('updated_at', 'updated_by', 'version')
    ) d;
  end if;
  -- summary にはタイトルのみ。notes / outline 等の本文は記録しない。
  insert into public.audit_events
    (workspace_id, actor_id, entity_type, entity_id, action, summary, changed_fields)
  values
    (new.workspace_id, (select auth.uid()), 'message', new.id, act, left(new.title, 80), changed);
  return new;
end;
$$;

create trigger messages_audit
  after insert or update on public.messages
  for each row execute function public.audit_message_changes();

-- ---------------------------------------------------------------------------
-- bible_books seed（生成元: scripts/gen-bible-books-sql.ts）
-- ---------------------------------------------------------------------------
insert into public.bible_books
  (osis, canonical_order, testament, genre, name_ja, short_name_ja, name_en, aliases, chapter_count)
values
  ('Gen', 1, 'old', '律法', '創世記', '創世記', 'Genesis', '["創世","創","Gn"]'::jsonb, 50),
  ('Exod', 2, 'old', '律法', '出エジプト記', '出エジプト', 'Exodus', '["出エジプト","出","Ex","Exo"]'::jsonb, 40),
  ('Lev', 3, 'old', '律法', 'レビ記', 'レビ記', 'Leviticus', '["レビ","Lv"]'::jsonb, 27),
  ('Num', 4, 'old', '律法', '民数記', '民数記', 'Numbers', '["民数","民","Nm","Nu"]'::jsonb, 36),
  ('Deut', 5, 'old', '律法', '申命記', '申命記', 'Deuteronomy', '["申命","申","Dt"]'::jsonb, 34),
  ('Josh', 6, 'old', '歴史書', 'ヨシュア記', 'ヨシュア記', 'Joshua', '["ヨシュア","ヨシュ","Jos"]'::jsonb, 24),
  ('Judg', 7, 'old', '歴史書', '士師記', '士師記', 'Judges', '["士師","士","Jdg"]'::jsonb, 21),
  ('Ruth', 8, 'old', '歴史書', 'ルツ記', 'ルツ記', 'Ruth', '["ルツ","Ru"]'::jsonb, 4),
  ('1Sam', 9, 'old', '歴史書', 'サムエル記第一', 'Ⅰサムエル', '1 Samuel', '["サムエル記上","Ⅰサムエル","Ⅰサム","1Samuel"]'::jsonb, 31),
  ('2Sam', 10, 'old', '歴史書', 'サムエル記第二', 'Ⅱサムエル', '2 Samuel', '["サムエル記下","Ⅱサムエル","Ⅱサム","2Samuel"]'::jsonb, 24),
  ('1Kgs', 11, 'old', '歴史書', '列王記第一', 'Ⅰ列王記', '1 Kings', '["列王記上","Ⅰ列王記","Ⅰ列王","Ⅰ列","1Kings"]'::jsonb, 22),
  ('2Kgs', 12, 'old', '歴史書', '列王記第二', 'Ⅱ列王記', '2 Kings', '["列王記下","Ⅱ列王記","Ⅱ列王","Ⅱ列","2Kings"]'::jsonb, 25),
  ('1Chr', 13, 'old', '歴史書', '歴代誌第一', 'Ⅰ歴代誌', '1 Chronicles', '["歴代誌上","Ⅰ歴代誌","Ⅰ歴代","Ⅰ歴","1Chronicles"]'::jsonb, 29),
  ('2Chr', 14, 'old', '歴史書', '歴代誌第二', 'Ⅱ歴代誌', '2 Chronicles', '["歴代誌下","Ⅱ歴代誌","Ⅱ歴代","Ⅱ歴","2Chronicles"]'::jsonb, 36),
  ('Ezra', 15, 'old', '歴史書', 'エズラ記', 'エズラ記', 'Ezra', '["エズラ","エズ","Ezr"]'::jsonb, 10),
  ('Neh', 16, 'old', '歴史書', 'ネヘミヤ記', 'ネヘミヤ記', 'Nehemiah', '["ネヘミヤ","ネヘ","Ne"]'::jsonb, 13),
  ('Esth', 17, 'old', '歴史書', 'エステル記', 'エステル記', 'Esther', '["エステル","エス","Est"]'::jsonb, 10),
  ('Job', 18, 'old', '詩歌書', 'ヨブ記', 'ヨブ記', 'Job', '["ヨブ","Jb"]'::jsonb, 42),
  ('Ps', 19, 'old', '詩歌書', '詩篇', '詩篇', 'Psalms', '["詩編","詩","Psalm","Psa","Pss"]'::jsonb, 150),
  ('Prov', 20, 'old', '詩歌書', '箴言', '箴言', 'Proverbs', '["箴","Pr","Prv"]'::jsonb, 31),
  ('Eccl', 21, 'old', '詩歌書', '伝道者の書', '伝道者の書', 'Ecclesiastes', '["伝道者","伝道の書","コヘレトの言葉","コヘレト","伝","Ecc","Qoheleth"]'::jsonb, 12),
  ('Song', 22, 'old', '詩歌書', '雅歌', '雅歌', 'Song of Songs', '["雅","Song of Solomon","Cant","SS"]'::jsonb, 8),
  ('Isa', 23, 'old', '大預言書', 'イザヤ書', 'イザヤ書', 'Isaiah', '["イザヤ","イザ","Is"]'::jsonb, 66),
  ('Jer', 24, 'old', '大預言書', 'エレミヤ書', 'エレミヤ書', 'Jeremiah', '["エレミヤ","エレ","Je"]'::jsonb, 52),
  ('Lam', 25, 'old', '大預言書', '哀歌', '哀歌', 'Lamentations', '["哀","La"]'::jsonb, 5),
  ('Ezek', 26, 'old', '大預言書', 'エゼキエル書', 'エゼキエル書', 'Ezekiel', '["エゼキエル","エゼ","Eze","Ezk"]'::jsonb, 48),
  ('Dan', 27, 'old', '大預言書', 'ダニエル書', 'ダニエル書', 'Daniel', '["ダニエル","ダニ","Da","Dn"]'::jsonb, 12),
  ('Hos', 28, 'old', '小預言書', 'ホセア書', 'ホセア書', 'Hosea', '["ホセア","ホセ","Ho"]'::jsonb, 14),
  ('Joel', 29, 'old', '小預言書', 'ヨエル書', 'ヨエル書', 'Joel', '["ヨエル","ヨエ","Jl"]'::jsonb, 3),
  ('Amos', 30, 'old', '小預言書', 'アモス書', 'アモス書', 'Amos', '["アモス","アモ","Am"]'::jsonb, 9),
  ('Obad', 31, 'old', '小預言書', 'オバデヤ書', 'オバデヤ書', 'Obadiah', '["オバデヤ","オバ","Ob"]'::jsonb, 1),
  ('Jonah', 32, 'old', '小預言書', 'ヨナ書', 'ヨナ書', 'Jonah', '["ヨナ","Jon"]'::jsonb, 4),
  ('Mic', 33, 'old', '小預言書', 'ミカ書', 'ミカ書', 'Micah', '["ミカ","Mc"]'::jsonb, 7),
  ('Nah', 34, 'old', '小預言書', 'ナホム書', 'ナホム書', 'Nahum', '["ナホム","ナホ","Na"]'::jsonb, 3),
  ('Hab', 35, 'old', '小預言書', 'ハバクク書', 'ハバクク書', 'Habakkuk', '["ハバクク","ハバ","Hb"]'::jsonb, 3),
  ('Zeph', 36, 'old', '小預言書', 'ゼパニヤ書', 'ゼパニヤ書', 'Zephaniah', '["ゼパニヤ","ゼパ","Zep","Zph"]'::jsonb, 3),
  ('Hag', 37, 'old', '小預言書', 'ハガイ書', 'ハガイ書', 'Haggai', '["ハガイ","ハガ","Hg"]'::jsonb, 2),
  ('Zech', 38, 'old', '小預言書', 'ゼカリヤ書', 'ゼカリヤ書', 'Zechariah', '["ゼカリヤ","ゼカ","Zec","Zch"]'::jsonb, 14),
  ('Mal', 39, 'old', '小預言書', 'マラキ書', 'マラキ書', 'Malachi', '["マラキ","マラ","Ml"]'::jsonb, 4),
  ('Matt', 40, 'new', '福音書', 'マタイの福音書', 'マタイ', 'Matthew', '["マタイ","マタイによる福音書","マタ","Mt"]'::jsonb, 28),
  ('Mark', 41, 'new', '福音書', 'マルコの福音書', 'マルコ', 'Mark', '["マルコ","マルコによる福音書","マコ","Mk","Mrk"]'::jsonb, 16),
  ('Luke', 42, 'new', '福音書', 'ルカの福音書', 'ルカ', 'Luke', '["ルカ","ルカによる福音書","Lk","Luk"]'::jsonb, 24),
  ('John', 43, 'new', '福音書', 'ヨハネの福音書', 'ヨハネ', 'John', '["ヨハネ","ヨハネによる福音書","ヨハ","Jn","Joh","Jhn"]'::jsonb, 21),
  ('Acts', 44, 'new', '歴史書', '使徒の働き', '使徒', 'Acts', '["使徒","使徒言行録","使徒行伝","使","Ac"]'::jsonb, 28),
  ('Rom', 45, 'new', 'パウロ書簡', 'ローマ人への手紙', 'ローマ', 'Romans', '["ローマ","ロマ","Ro","Rm"]'::jsonb, 16),
  ('1Cor', 46, 'new', 'パウロ書簡', 'コリント人への手紙第一', 'Ⅰコリント', '1 Corinthians', '["Ⅰコリント","Ⅰコリ","1Corinthians"]'::jsonb, 16),
  ('2Cor', 47, 'new', 'パウロ書簡', 'コリント人への手紙第二', 'Ⅱコリント', '2 Corinthians', '["Ⅱコリント","Ⅱコリ","2Corinthians"]'::jsonb, 13),
  ('Gal', 48, 'new', 'パウロ書簡', 'ガラテヤ人への手紙', 'ガラテヤ', 'Galatians', '["ガラテヤ","ガラ","Ga"]'::jsonb, 6),
  ('Eph', 49, 'new', 'パウロ書簡', 'エペソ人への手紙', 'エペソ', 'Ephesians', '["エペソ","エフェソ","エペ","Ep"]'::jsonb, 6),
  ('Phil', 50, 'new', 'パウロ書簡', 'ピリピ人への手紙', 'ピリピ', 'Philippians', '["ピリピ","フィリピ","ピリ","Php","Pp"]'::jsonb, 4),
  ('Col', 51, 'new', 'パウロ書簡', 'コロサイ人への手紙', 'コロサイ', 'Colossians', '["コロサイ","コロ","Cl"]'::jsonb, 4),
  ('1Thess', 52, 'new', 'パウロ書簡', 'テサロニケ人への手紙第一', 'Ⅰテサロニケ', '1 Thessalonians', '["Ⅰテサロニケ","Ⅰテサ","1Thessalonians","1Thes","1Th"]'::jsonb, 5),
  ('2Thess', 53, 'new', 'パウロ書簡', 'テサロニケ人への手紙第二', 'Ⅱテサロニケ', '2 Thessalonians', '["Ⅱテサロニケ","Ⅱテサ","2Thessalonians","2Thes","2Th"]'::jsonb, 3),
  ('1Tim', 54, 'new', 'パウロ書簡', 'テモテへの手紙第一', 'Ⅰテモテ', '1 Timothy', '["Ⅰテモテ","Ⅰテモ","1Timothy","1Ti"]'::jsonb, 6),
  ('2Tim', 55, 'new', 'パウロ書簡', 'テモテへの手紙第二', 'Ⅱテモテ', '2 Timothy', '["Ⅱテモテ","Ⅱテモ","2Timothy","2Ti"]'::jsonb, 4),
  ('Titus', 56, 'new', 'パウロ書簡', 'テトスへの手紙', 'テトス', 'Titus', '["テトス","テト","Tit","Ti"]'::jsonb, 3),
  ('Phlm', 57, 'new', 'パウロ書簡', 'ピレモンへの手紙', 'ピレモン', 'Philemon', '["ピレモン","フィレモン","ピレ","Phm","Pm"]'::jsonb, 1),
  ('Heb', 58, 'new', '公同書簡', 'ヘブル人への手紙', 'ヘブル', 'Hebrews', '["ヘブル","ヘブライ人への手紙","ヘブライ","ヘブ","He"]'::jsonb, 13),
  ('Jas', 59, 'new', '公同書簡', 'ヤコブの手紙', 'ヤコブ', 'James', '["ヤコブ","ヤコ","Jam","Jm"]'::jsonb, 5),
  ('1Pet', 60, 'new', '公同書簡', 'ペテロの手紙第一', 'Ⅰペテロ', '1 Peter', '["Ⅰペテロ","Ⅰペテ","1Peter","1Pe","1Pt"]'::jsonb, 5),
  ('2Pet', 61, 'new', '公同書簡', 'ペテロの手紙第二', 'Ⅱペテロ', '2 Peter', '["Ⅱペテロ","Ⅱペテ","2Peter","2Pe","2Pt"]'::jsonb, 3),
  ('1John', 62, 'new', '公同書簡', 'ヨハネの手紙第一', 'Ⅰヨハネ', '1 John', '["Ⅰヨハネ","Ⅰヨハ","1Jn","1Jo"]'::jsonb, 5),
  ('2John', 63, 'new', '公同書簡', 'ヨハネの手紙第二', 'Ⅱヨハネ', '2 John', '["Ⅱヨハネ","Ⅱヨハ","2Jn","2Jo"]'::jsonb, 1),
  ('3John', 64, 'new', '公同書簡', 'ヨハネの手紙第三', 'Ⅲヨハネ', '3 John', '["Ⅲヨハネ","Ⅲヨハ","3Jn","3Jo"]'::jsonb, 1),
  ('Jude', 65, 'new', '公同書簡', 'ユダの手紙', 'ユダ', 'Jude', '["ユダ","Jud","Jd"]'::jsonb, 1),
  ('Rev', 66, 'new', '黙示文学', 'ヨハネの黙示録', '黙示録', 'Revelation', '["黙示録","ヨハネ黙示録","黙示","黙","Re","Rv","Apocalypse"]'::jsonb, 22);
