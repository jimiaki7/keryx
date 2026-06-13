-- KX-023: 基本分析。説教箇所の旧約/新約・ジャンル・書巻・主題の分布と、
-- Message 単位（説教内容）と Delivery 単位（実施回数）の区別を集計する。
--
-- 方針（TECHNICAL_ARCHITECTURE §8）: クライアントで巨大集計をせず、期間指定 RPC に寄せる。
-- SECURITY INVOKER で RLS（is_active_member）が workspace 分離を強制する。
-- 期間（Asia/Tokyo 暦日）を渡すと「その期間に語った（delivery がある）Message」に限定し、
-- 無指定なら workspace の全 Message（未実施の下書き含む）を対象にする。
-- 集計は Message 単位（count distinct message）。実施回数のみ Delivery 単位。

create function public.message_analytics(
  p_workspace uuid,
  p_from date default null,
  p_to date default null
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with scoped as (
    select m.id, m.metadata
    from public.messages m
    where m.workspace_id = p_workspace
      and m.deleted_at is null
      and (
        (p_from is null and p_to is null)
        or exists (
          select 1
          from public.message_deliveries d
          join public.gatherings g
            on g.id = d.gathering_id and g.deleted_at is null and g.status <> 'canceled'
          where d.message_id = m.id
            and (p_from is null or (g.starts_at at time zone 'Asia/Tokyo')::date >= p_from)
            and (p_to is null or (g.starts_at at time zone 'Asia/Tokyo')::date <= p_to)
        )
      )
  ),
  cited as (
    select distinct
      s.id as message_id, bb.osis, bb.name_ja, bb.testament, bb.genre, bb.canonical_order
    from scoped s
    join public.message_passages mp on mp.message_id = s.id
    join public.bible_books bb on bb.osis = mp.book_id
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'messages', (select count(*) from scoped),
      'messages_with_passage', (select count(distinct message_id) from cited),
      'messages_with_theme', (
        select count(*) from scoped s
        where nullif(btrim(coalesce(s.metadata -> 'legacy' ->> 'theme', '')), '') is not null
      ),
      'deliveries', (
        select count(*)
        from public.message_deliveries d
        join public.gatherings g
          on g.id = d.gathering_id and g.deleted_at is null and g.status <> 'canceled'
        join scoped s on s.id = d.message_id
        where (p_from is null or (g.starts_at at time zone 'Asia/Tokyo')::date >= p_from)
          and (p_to is null or (g.starts_at at time zone 'Asia/Tokyo')::date <= p_to)
      )
    ),
    -- 旧約→新約の順（testament desc: 'old' > 'new'）
    'testament', (
      select coalesce(jsonb_agg(
        jsonb_build_object('key', t.testament, 'messages', t.c) order by t.testament desc
      ), '[]'::jsonb)
      from (select testament, count(distinct message_id) c from cited group by testament) t
    ),
    -- ジャンルは聖書配列順（最小 canonical_order）で。公同書簡などの表記は bible_books に従う
    'genre', (
      select coalesce(jsonb_agg(
        jsonb_build_object('genre', g.genre, 'messages', g.c) order by g.ord
      ), '[]'::jsonb)
      from (
        select genre, count(distinct message_id) c, min(canonical_order) ord
        from cited group by genre
      ) g
    ),
    'books', (
      select coalesce(jsonb_agg(
        jsonb_build_object('book_id', b.osis, 'name', b.name_ja, 'messages', b.c)
        order by b.canonical_order
      ), '[]'::jsonb)
      from (
        select osis, name_ja, canonical_order, count(distinct message_id) c
        from cited group by osis, name_ja, canonical_order
      ) b
    ),
    'themes', (
      select coalesce(jsonb_agg(
        jsonb_build_object('theme', th.theme, 'messages', th.c) order by th.c desc, th.theme
      ), '[]'::jsonb)
      from (
        select s.metadata -> 'legacy' ->> 'theme' as theme, count(*) c
        from scoped s
        where nullif(btrim(coalesce(s.metadata -> 'legacy' ->> 'theme', '')), '') is not null
        group by s.metadata -> 'legacy' ->> 'theme'
      ) th
    )
  );
$$;

revoke execute on function public.message_analytics(uuid, date, date) from public, anon;
grant execute on function public.message_analytics(uuid, date, date) to authenticated;
