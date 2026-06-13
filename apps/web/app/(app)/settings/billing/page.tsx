import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { PLAN_DESCRIPTIONS, PLAN_LABELS, SUBSCRIPTION_STATUS_LABELS } from '@/lib/labels';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';

export const metadata: Metadata = { title: 'プラン' };

const PLANS = ['free', 'personal', 'church'] as const;

export default async function BillingPage() {
  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status, current_period_end, grace_until')
    .eq('workspace_id', workspace.id)
    .maybeSingle();

  // row が無ければ free（既定）
  const plan = sub?.plan ?? 'free';
  const status = sub?.status ?? 'active';

  return (
    <>
      <PageHeader title="プランと課金" description="ワークスペースのプランを確認します。" />
      <div className="flex flex-col gap-6">
        <Link href="/settings" className="text-sm text-ink-muted hover:text-ink">
          ← 設定
        </Link>

        <section
          aria-label="現在のプラン"
          className="rounded-lg border border-line bg-paper-raised p-4"
        >
          <h2 className="text-sm font-medium text-ink">現在のプラン</h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-lg font-medium text-indigo-deep">
              {PLAN_LABELS[plan] ?? plan}
            </span>
            <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-muted">
              {SUBSCRIPTION_STATUS_LABELS[status] ?? status}
            </span>
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            データはどのプランでもいつでもエクスポートできます（設定＞エクスポート）。
            有料プランの申し込みは準備中です。
          </p>
        </section>

        <section aria-label="プラン一覧" className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-ink">プラン</h2>
          <ul className="flex flex-col gap-2">
            {PLANS.map((p) => (
              <li
                key={p}
                className={`rounded-lg border bg-paper-raised px-4 py-3 ${
                  p === plan ? 'border-indigo-deep' : 'border-line'
                }`}
              >
                <div className="flex flex-wrap items-center gap-x-3">
                  <span className="font-medium text-ink">{PLAN_LABELS[p]}</span>
                  {p === plan ? (
                    <span className="rounded-full bg-indigo-deep/5 px-2 py-0.5 text-xs text-indigo-deep">
                      利用中
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-ink-muted">{PLAN_DESCRIPTIONS[p]}</p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-muted">
            価格と申し込みは今後追加します。無料プランでもご自身のデータの取り出しは制限しません。
          </p>
        </section>
      </div>
    </>
  );
}
