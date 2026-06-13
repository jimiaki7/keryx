-- E11（課金）の土台: 購読/プランのデータモデル。決済プロバイダ接続は後段（ADR §14）。
-- 重要: 課金状態はユーザーが書き換えられない（自己アップグレード防止）。変更は service_role
-- （将来のプロバイダ webhook）経由のみ。row が無い workspace は free 扱い（UI 既定）。

create table public.subscriptions (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'personal', 'church')),
  status text not null default 'active'
    check (status in ('active', 'trialing', 'past_due', 'canceled')),
  current_period_end timestamptz,
  -- 支払い失敗時の猶予期限（猶予中も閲覧・エクスポートは維持する方針）
  grace_until timestamptz,
  provider text,
  external_customer_id text,
  external_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon;
-- 認証ユーザーは閲覧のみ。作成・変更は service_role（プロバイダ連携）に限る。
grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;

create policy subscriptions_select_member on public.subscriptions
  for select using (public.is_active_member(workspace_id));
-- insert/update/delete ポリシーは定義しない（authenticated からの書き込みは不可）
