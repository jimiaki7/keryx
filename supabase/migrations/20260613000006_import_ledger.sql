-- KX-021: トランザクショナルなスプレッドシート取り込み
-- Dry Run（KX-020）で検証済みの行を、1関数=1トランザクションで投入する。
--
-- 方針:
-- - SECURITY INVOKER（既定）。RLS が workspace 分離と書き込みロールを強制する。
--   service role や security definer で RLS を迂回しない（多層防御）。
-- - 行ごとに savepoint（plpgsql の BEGIN ... EXCEPTION）を張り、1行の失敗が
--   バッチ全体を巻き戻さない。失敗は行単位で報告する（§10 部分失敗の報告）。
-- - 再実行安全性（§5）: legacy_id を持つ行は legacy_id 一致でのみスキップする。legacy_id を
--   持たない行のみ fingerprint 一致でスキップする（fingerprint は会場を含まないため、同日同箇所の
--   別 Gathering を誤って捨てないようにする）。同一バッチ内重複も先に insert した行が見えるため拾う。
-- - batch_id を metadata.import.batch_id に保存し、undo_import_batch で一括ソフトデリート可能にする。

-- gatherings に metadata を追加（legacy_id / import.batch_id を保持してバッチ取り消しに使う）
alter table public.gatherings
  add column metadata jsonb not null default '{}'::jsonb;

-- series 名は workspace 内で一意（venues と同じく find-or-create を競合安全にする）。
-- これが無いと同名 series が並行作成で二重登録される。
create unique index series_workspace_name_key
  on public.series (workspace_id, name)
  where deleted_at is null;

create function public.import_ledger_batch(
  p_workspace uuid,
  p_source_file text,
  p_batch_id uuid,
  p_rows jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  r jsonb;
  elem jsonb;
  results jsonb := '[]'::jsonb;
  v_role text;
  v_now timestamptz := now();
  v_row_number int;
  v_fingerprint text;
  v_legacy_id text;
  v_sqlstate text;
  v_existing uuid;
  v_series_id uuid;
  v_series_name text;
  v_series_pos numeric;
  v_venue_id uuid;
  v_venue_name text;
  v_message_id uuid;
  v_msg_display text;
  v_gathering_id uuid;
  v_gth_display text;
  v_starts_at timestamptz;
  v_gth_status text;
  v_meta jsonb;
  v_passage jsonb;
  v_manuscript text;
  v_source_links jsonb;
  v_observance text;
  v_pos numeric;
begin
  if p_workspace is null or p_batch_id is null then
    raise exception 'workspace and batch are required';
  end if;
  -- 取り込みは Message を作るため owner / pastor のみ（planner では不可）
  v_role := public.member_role(p_workspace);
  if v_role is null or v_role not in ('owner', 'pastor') then
    raise exception 'insufficient privileges to import into this workspace';
  end if;

  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_row_number := coalesce((r ->> 'row_number')::int, 0);
    v_fingerprint := coalesce(r ->> 'fingerprint', '');
    v_legacy_id := coalesce(r ->> 'legacy_id', '');

    begin
      v_existing := null;
      v_series_id := null;
      v_venue_id := null;

      -- 冪等（KX-019 §5）: legacy_id を持つ行は legacy_id 一致のみでスキップする。
      -- fingerprint は legacy_id を含まないため（date|kind|book|cv|title）、同じ説教を同日に
      -- 別会場で語った行（legacy_id は -01 / -02 で異なる）が fingerprint 一致で誤って捨てられるのを防ぐ。
      -- legacy_id を持たない手入力由来の行のみ、再実行安全性のため fingerprint でスキップする。
      -- 同一トランザクション内で先に insert した行も見えるため、ファイル内重複も拾う。
      select m.id into v_existing
      from public.messages m
      where m.workspace_id = p_workspace
        and m.deleted_at is null
        and (
          case
            when v_legacy_id <> '' then m.metadata ->> 'legacy_id' = v_legacy_id
            else v_fingerprint <> '' and m.metadata -> 'import' ->> 'fingerprint' = v_fingerprint
          end
        )
      limit 1;

      if v_existing is not null then
        results := results || jsonb_build_object(
          'row_number', v_row_number, 'status', 'skipped',
          'legacy_id', v_legacy_id, 'reason', '既存の取り込みと重複'
        );
        continue;
      end if;

      -- series find-or-create（名前で照合。並行 insert は ON CONFLICT で吸収して再 select）
      v_series_name := nullif(btrim(coalesce(r ->> 'series_name', '')), '');
      if v_series_name is not null then
        select s.id into v_series_id
        from public.series s
        where s.workspace_id = p_workspace and s.deleted_at is null and s.name = v_series_name
        limit 1;
        if v_series_id is null then
          insert into public.series (workspace_id, name, status)
          values (p_workspace, v_series_name, 'active')
          on conflict (workspace_id, name) where deleted_at is null do nothing
          returning id into v_series_id;
          if v_series_id is null then
            select s.id into v_series_id
            from public.series s
            where s.workspace_id = p_workspace and s.deleted_at is null and s.name = v_series_name
            limit 1;
          end if;
        end if;
      end if;

      -- venue find-or-create（並行 insert は ON CONFLICT で吸収して再 select）
      v_venue_name := nullif(btrim(coalesce(r ->> 'venue', '')), '');
      if v_venue_name is not null then
        select v.id into v_venue_id
        from public.venues v
        where v.workspace_id = p_workspace and v.deleted_at is null and v.name = v_venue_name
        limit 1;
        if v_venue_id is null then
          insert into public.venues (workspace_id, name)
          values (p_workspace, v_venue_name)
          on conflict (workspace_id, name) where deleted_at is null do nothing
          returning id into v_venue_id;
          if v_venue_id is null then
            select v.id into v_venue_id
            from public.venues v
            where v.workspace_id = p_workspace and v.deleted_at is null and v.name = v_venue_name
            limit 1;
          end if;
        end if;
      end if;

      -- message metadata（破棄しない: legacy / migration_notes を保持）
      v_manuscript := coalesce(r -> 'legacy' ->> 'manuscript_ref', '');
      v_source_links := '[]'::jsonb;
      if v_manuscript ~ '^https?://' then
        v_source_links := jsonb_build_array(jsonb_build_object('url', v_manuscript, 'label', '原稿'));
      end if;
      v_observance := nullif(btrim(coalesce(r -> 'legacy' ->> 'observance', '')), '');
      v_meta := jsonb_build_object(
        'legacy_id', v_legacy_id,
        'import', jsonb_build_object(
          'source_row_number', v_row_number,
          'fingerprint', v_fingerprint,
          'imported_at', v_now,
          'source_file', coalesce(p_source_file, ''),
          'batch_id', p_batch_id
        ),
        'legacy', coalesce(r -> 'legacy', '{}'::jsonb),
        'migration_notes', coalesce(r -> 'migration_notes', '[]'::jsonb)
      );
      if v_observance is not null then
        v_meta := v_meta || jsonb_build_object('legacy_observance', v_observance);
      end if;

      insert into public.messages (
        workspace_id, type, title, central_message, notes_markdown,
        status, preparation_stage, primary_series_id, source_links, metadata
      ) values (
        p_workspace,
        coalesce(r ->> 'type', 'other'),
        coalesce(r ->> 'title', ''),
        coalesce(r ->> 'central_message', ''),
        coalesce(r ->> 'notes', ''),
        coalesce(r ->> 'status', 'planned'),
        coalesce(r ->> 'preparation_stage', 'not_started'),
        v_series_id, v_source_links, v_meta
      ) returning id, display_id into v_message_id, v_msg_display;

      -- passage（あれば primary）
      v_passage := r -> 'passage';
      if v_passage is not null and jsonb_typeof(v_passage) = 'object' then
        insert into public.message_passages (
          message_id, workspace_id, role, position, book_id,
          start_chapter, start_verse, end_chapter, end_verse, display_text
        ) values (
          v_message_id, p_workspace, 'primary', 1, v_passage ->> 'book_id',
          (v_passage ->> 'start_chapter')::smallint,
          nullif(v_passage ->> 'start_verse', '')::smallint,
          (v_passage ->> 'end_chapter')::smallint,
          nullif(v_passage ->> 'end_verse', '')::smallint,
          coalesce(v_passage ->> 'display_text', '')
        );
      end if;

      -- gathering（starts_at は呼び出し側が +09:00 付き ISO を渡す。過去→completed）
      v_starts_at := (r ->> 'starts_at')::timestamptz;
      v_gth_status := case when v_starts_at < v_now then 'completed' else 'scheduled' end;
      insert into public.gatherings (
        workspace_id, title, kind, starts_at, timezone, venue_id, status, notes, metadata
      ) values (
        p_workspace,
        coalesce(r ->> 'gathering_title', ''),
        coalesce(r ->> 'kind', 'sunday_worship'),
        v_starts_at, 'Asia/Tokyo', v_venue_id, v_gth_status,
        case when v_observance is not null then '行事: ' || v_observance else '' end,
        jsonb_build_object(
          'legacy_id', v_legacy_id,
          'import', jsonb_build_object('batch_id', p_batch_id, 'source_row_number', v_row_number)
        )
      ) returning id, display_id into v_gathering_id, v_gth_display;

      -- delivery（Message ↔ Gathering）
      insert into public.message_deliveries (message_id, gathering_id, workspace_id, speaker_name)
      values (v_message_id, v_gathering_id, p_workspace, coalesce(r ->> 'speaker', ''));

      -- series_messages（シリーズ回を position に。無ければ末尾）
      if v_series_id is not null then
        v_series_pos := nullif(r ->> 'series_number', '')::numeric;
        if v_series_pos is null or v_series_pos <= 0 then
          -- ソフトデリート済み Message にぶら下がる series_messages（undo 後の亡霊）を数えない
          select coalesce(max(sm.position), 0) + 1 into v_series_pos
          from public.series_messages sm
          join public.messages m on m.id = sm.message_id and m.deleted_at is null
          where sm.series_id = v_series_id;
        end if;
        insert into public.series_messages (series_id, message_id, workspace_id, position)
        values (v_series_id, v_message_id, p_workspace, v_series_pos)
        on conflict (series_id, message_id) do nothing;
      end if;

      -- service_elements（§4.4 の順序。position は出現順）
      v_pos := 0;
      for elem in select * from jsonb_array_elements(coalesce(r -> 'elements', '[]'::jsonb))
      loop
        v_pos := v_pos + 1;
        insert into public.service_elements (
          gathering_id, workspace_id, position, type, title, metadata
        ) values (
          v_gathering_id, p_workspace, v_pos,
          coalesce(elem ->> 'type', 'custom'),
          coalesce(elem ->> 'title', ''),
          case when elem ? 'ceremony_type'
               then jsonb_build_object('ceremony_type', elem ->> 'ceremony_type')
               else '{}'::jsonb end
        );
      end loop;

      results := results || jsonb_build_object(
        'row_number', v_row_number, 'status', 'created',
        'legacy_id', v_legacy_id, 'message_id', v_message_id,
        'message_display_id', v_msg_display, 'gathering_display_id', v_gth_display
      );
    exception when others then
      -- データ品質起因（22xxx データ例外 / 23xxx 整合性制約違反）だけを「行のエラー」に降格し、
      -- 残りの partial work を巻き戻して次の行へ進む。それ以外（権限 42501、デッドロック/直列化
      -- 40001・40P01、未定義オブジェクト等の systemic な失敗）は握りつぶさず再 raise し、
      -- バッチ全体を失敗させて呼び出し側に明確に伝える（全行が偽「成功」になるのを防ぐ）。
      get stacked diagnostics v_sqlstate = returned_sqlstate;
      if v_sqlstate like '22%' or v_sqlstate like '23%' then
        results := results || jsonb_build_object(
          'row_number', v_row_number, 'status', 'error',
          'legacy_id', v_legacy_id, 'reason', sqlerrm
        );
      else
        raise;
      end if;
    end;
  end loop;

  return results;
end;
$$;

revoke execute on function public.import_ledger_batch(uuid, text, uuid, jsonb) from public, anon;
grant execute on function public.import_ledger_batch(uuid, text, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- バッチの取り消し（ソフトデリート）。metadata.import.batch_id で関連行をまとめて消す。
-- ---------------------------------------------------------------------------
create function public.undo_import_batch(p_workspace uuid, p_batch_id uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  n integer;
  v_role text;
begin
  v_role := public.member_role(p_workspace);
  if v_role is null or v_role not in ('owner', 'pastor') then
    raise exception 'insufficient privileges';
  end if;
  update public.gatherings
    set deleted_at = now()
    where workspace_id = p_workspace
      and deleted_at is null
      and metadata -> 'import' ->> 'batch_id' = p_batch_id::text;
  update public.messages
    set deleted_at = now()
    where workspace_id = p_workspace
      and deleted_at is null
      and metadata -> 'import' ->> 'batch_id' = p_batch_id::text;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.undo_import_batch(uuid, uuid) from public, anon;
grant execute on function public.undo_import_batch(uuid, uuid) to authenticated;
