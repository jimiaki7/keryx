-- 表示ID（MSG-/GTH-YYYY-NNNN）の桁あふれ衝突を修正する。
--
-- 不具合: next_display_id は `lpad(n::text, 4, '0')` で4桁ゼロ詰めしていたが、
-- PostgreSQL の lpad は元文字列が幅より長いと右側を切り詰める（'10000' → '1000'）。
-- このため年内 10000 件目（counter=10000）の表示IDが 1000 件目（counter=1000）の
-- 'MSG-/GTH-YYYY-1000' と衝突し、unique(workspace_id, display_id) 制約違反で insert が失敗する。
-- プロダクト仕様は workspace あたり 10,000 Message を想定しており、現実的に到達しうる。
--
-- 修正: 最小幅 4 桁のゼロ詰めに留め、10000 以上は切り詰めず自然に桁を増やす
-- （greatest(4, length(...)) で「幅 >= 文字数」を保証し、lpad の切り詰めを起こさない）。
-- 採番カウンタ自体は衝突しない。問題は整形後の文字列だけなので、整形のみを直す。
-- 既発行ID（n<=9999 は従来どおりゼロ詰め4桁）は不変で、再採番もしない。
-- next_display_id は messages / gatherings の before-insert トリガーが共用するため、両方が直る。

create or replace function public.next_display_id(target_workspace uuid, entity_name text, prefix text)
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
  -- 最小4桁ゼロ詰め。10000 以上は切り詰めず桁が伸びる（衝突しない）
  return prefix || '-' || y || '-' || lpad(n::text, greatest(4, length(n::text)), '0');
end;
$$;

-- create or replace は ACL を保持するが、意図を明示するため revoke を再発行する
-- （呼び出すのは security definer のトリガーのみ。authenticated 等から直接実行させない）
revoke execute on function public.next_display_id(uuid, text, text) from public, anon, authenticated;
