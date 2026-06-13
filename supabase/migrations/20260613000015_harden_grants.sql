-- 権限のハードニング（本番ホスティング環境の既定権限差を吸収する）。
--
-- 背景: Supabase 本番は `alter default privileges in schema public grant all on tables
-- to authenticated`（相当）を持つため、新規テーブル作成時に authenticated へ全権限が
-- 既定付与される。従来 anon からのみ revoke していたテーブル（authenticated からは
-- revoke していない）では、本番で authenticated に意図しない DELETE/UPDATE/INSERT が残る。
-- RLS が該当操作のポリシー不在で既定拒否するため実害はないが、設計どおりの最小権限
-- （多層防御）に揃える。ローカル CLI は既定付与が異なり該当権限が元々無いため no-op。
--
-- 対象（intended と本番実権限の差分。いずれもソフトデリート方針で authenticated に
-- ハード DELETE を与えない／課金・AI 提案は限定権限のみ）:
--   messages/series/venues/gatherings/observances/invitations : DELETE を剥奪
--   ai_suggestions   : DELETE, UPDATE を剥奪（status 変更は承認 RPC のみ）
--   subscriptions    : DELETE, INSERT, UPDATE を剥奪（課金状態は service_role のみ変更）

revoke delete on
  public.messages,
  public.series,
  public.venues,
  public.gatherings,
  public.observances,
  public.invitations
  from authenticated;

revoke delete, update on public.ai_suggestions from authenticated;

revoke delete, insert, update on public.subscriptions from authenticated;
