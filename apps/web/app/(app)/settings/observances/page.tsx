import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';
import { applyObservancePreset } from './actions';
import { ObservanceManager, type ObservanceRow } from './observance-manager';

export const metadata: Metadata = { title: '教会暦' };

export default async function ObservancesPage() {
  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  const { data } = await supabase
    .from('observances')
    .select('id, name, kind, starts_on, ends_on, color, source')
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .order('starts_on', { ascending: true });

  const currentYear = new Date().getFullYear();
  const observances = (data ?? []) as ObservanceRow[];

  return (
    <>
      <PageHeader
        title="教会暦・行事"
        description="アドベントやイースターなどの教会暦を管理します。"
      />
      <div className="flex flex-col gap-5">
        <Link href="/settings" className="text-sm text-ink-muted hover:text-ink">
          ← 設定
        </Link>

        <section
          aria-label="教会暦プリセットの適用"
          className="rounded-lg border border-line bg-paper-raised p-4"
        >
          <h2 className="text-sm font-medium text-ink">教会暦プリセットを適用</h2>
          <p className="mt-1 text-xs text-ink-muted">
            指定年のアドベント・受難週・イースター・ペンテコステ・召天者記念・クリスマス・元旦を追加します。
            再適用しても重複せず、名称変更・削除した項目はそのまま保持されます。
          </p>
          <form action={applyObservancePreset} className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ink-muted">年</span>
              <input
                type="number"
                name="year"
                defaultValue={currentYear}
                min={2000}
                max={2100}
                className="w-28 rounded-md border border-line bg-paper px-2 py-1.5 text-sm"
              />
            </label>
            <button
              type="submit"
              className="rounded-md bg-indigo-deep px-4 py-2 text-sm font-medium text-paper-raised hover:bg-indigo-soft"
            >
              プリセットを適用
            </button>
          </form>
        </section>

        <ObservanceManager observances={observances} />

        <p className="text-xs text-ink-muted">
          教会暦はカレンダーに重ねて表示されます。シリーズ（連続講解の計画）とは別に管理されます。
        </p>
      </div>
    </>
  );
}
