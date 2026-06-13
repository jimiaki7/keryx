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
          aria-label="プランと課金"
          className="rounded-lg border border-line bg-paper-raised px-4 py-3"
        >
          <h2 className="text-sm font-medium text-ink">プランと課金</h2>
          <p className="mt-1 text-xs text-ink-muted">
            現在のプランを確認します（有料プランは準備中）。
          </p>
          <a
            href="/settings/billing"
            className="mt-3 inline-block rounded-md border border-line px-3 py-1.5 text-sm text-indigo-deep hover:bg-indigo-deep/5"
          >
            プランを確認
          </a>
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
          </div>
        </section>
        <section
          aria-label="メンバー"
          className="rounded-lg border border-line bg-paper-raised px-4 py-3"
        >
          <h2 className="text-sm font-medium text-ink">メンバーと権限</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Workspace のメンバーとロール（オーナー/牧師/計画担当/閲覧）を管理します。
          </p>
          <a
            href="/settings/members"
            className="mt-3 inline-block rounded-md border border-line px-3 py-1.5 text-sm text-indigo-deep hover:bg-indigo-deep/5"
          >
            メンバーを管理
          </a>
        </section>
        <section
          aria-label="教会暦"
          className="rounded-lg border border-line bg-paper-raised px-4 py-3"
        >
          <h2 className="text-sm font-medium text-ink">教会暦・行事</h2>
          <p className="mt-1 text-xs text-ink-muted">
            アドベント・イースターなどのプリセット適用や、独自の行事を管理します（カレンダーに表示）。
          </p>
          <a
            href="/settings/observances"
            className="mt-3 inline-block rounded-md border border-line px-3 py-1.5 text-sm text-indigo-deep hover:bg-indigo-deep/5"
          >
            教会暦を管理
          </a>
        </section>
        <section
          aria-label="インポート"
          className="rounded-lg border border-line bg-paper-raised px-4 py-3"
        >
          <h2 className="text-sm font-medium text-ink">インポート</h2>
          <p className="mt-1 text-xs text-ink-muted">
            年間説教プランナー（Spreadsheet v1.3.1）の台帳を取り込みます。
          </p>
          <a
            href="/settings/import"
            className="mt-3 inline-block rounded-md border border-line px-3 py-1.5 text-sm text-indigo-deep hover:bg-indigo-deep/5"
          >
            インポートへ（Dry Run）
          </a>
        </section>
        <section
          aria-label="履歴と復元"
          className="rounded-lg border border-line bg-paper-raised px-4 py-3"
        >
          <h2 className="text-sm font-medium text-ink">履歴と復元</h2>
          <p className="mt-1 text-xs text-ink-muted">
            変更履歴の確認と、削除したメッセージ・礼拝予定・シリーズの復元ができます。
          </p>
          <a
            href="/settings/history"
            className="mt-3 inline-block rounded-md border border-line px-3 py-1.5 text-sm text-indigo-deep hover:bg-indigo-deep/5"
          >
            履歴と復元へ
          </a>
        </section>
        <EmptyState
          title="詳細設定は準備中です"
          description="タイムゾーンや言語などをここで設定できるようになります。"
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
