-- 関数のセキュリティ・ハードニング（Supabase security advisor 対応）。
--
-- 1) set_updated_at に search_path を固定する（function_search_path_mutable の解消）。
--    他の関数は既に `set search_path = ''` 済み。これだけ未設定だった。
-- 2) SECURITY DEFINER のトリガー関数は REST/直接呼び出しの対象ではないため、
--    public/anon/authenticated から EXECUTE を剥奪する。トリガーの発火に EXECUTE 権限は
--    不要（トリガー機構が実行する）なので、テーブルの INSERT/UPDATE 時の発火には影響しない。
--    ※ is_active_member / member_role / create_workspace 等の「正規の RPC・RLS ヘルパー」は
--      authenticated から呼ぶ必要があるため EXECUTE を維持する（意図的）。

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.messages_before_insert() from public, anon, authenticated;
revoke execute on function public.audit_message_changes() from public, anon, authenticated;
revoke execute on function public.audit_row_changes() from public, anon, authenticated;
revoke execute on function public.gatherings_before_insert() from public, anon, authenticated;
revoke execute on function public.ai_suggestions_before_insert() from public, anon, authenticated;
