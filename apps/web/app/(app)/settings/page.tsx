import type { Metadata } from 'next';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { getActiveWorkspace } from '@/lib/workspace';
import { signOut } from '@/app/(public)/login/actions';

export const metadata: Metadata = { title: '設定' };

export default async function SettingsPage() {
  const workspace = await getActiveWorkspace();
  return (
    <>
      <PageHeader title="設定" description="Workspace・アカウント・表示の設定を行います。" />
      <div className="flex flex-col gap-6">
        <section
          aria-label="Workspace"
          className="rounded-lg border border-line bg-paper-raised px-4 py-3"
        >
          <h2 className="text-sm font-medium text-ink">Workspace</h2>
          <p className="mt-1 text-sm text-ink-muted">{workspace.name}</p>
        </section>
        <section
          aria-label="エクスポート"
          className="rounded-lg border border-line bg-paper-raised px-4 py-3"
        >
          <h2 className="text-sm font-medium text-ink">エクスポート</h2>
          <p className="mt-1 text-xs text-ink-muted">
            データはいつでも持ち出せます（プランに関わらず利用できます）。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="/api/exports/json"
              download
              className="rounded-md border border-line px-3 py-1.5 text-sm text-indigo-deep hover:bg-indigo-deep/5"
            >
              すべてのデータ（JSON）
            </a>
            <a
              href="/api/exports/csv?entity=messages"
              download
              className="rounded-md border border-line px-3 py-1.5 text-sm text-indigo-deep hover:bg-indigo-deep/5"
            >
              メッセージ一覧（CSV）
            </a>
            <a
              href="/api/exports/csv?entity=gatherings"
              download
              className="rounded-md border border-line px-3 py-1.5 text-sm text-indigo-deep hover:bg-indigo-deep/5"
            >
              礼拝予定一覧（CSV）
            </a>
          </div>
        </section>
        <EmptyState
          title="詳細設定は準備中です"
          description="タイムゾーンや教会暦プリセットなどをここで設定できるようになります。"
        />
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md border border-line bg-paper-raised px-4 py-2 text-sm font-medium text-ink hover:bg-indigo-deep/5"
          >
            ログアウト
          </button>
        </form>
      </div>
    </>
  );
}
