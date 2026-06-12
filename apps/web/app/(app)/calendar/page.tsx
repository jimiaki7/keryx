import type { Metadata } from 'next';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = { title: 'カレンダー' };

export default function CalendarPage() {
  return (
    <>
      <PageHeader title="カレンダー" description="月間・年間の礼拝予定と教会暦を見渡します。" />
      <EmptyState
        title="月間カレンダーは準備中です"
        description="それまでの間、礼拝予定はリスト表示で確認・作成できます。"
        action={
          <a
            href="/gatherings"
            className="inline-block rounded-md bg-indigo-deep px-4 py-2 text-sm font-medium text-paper-raised hover:bg-indigo-soft"
          >
            礼拝予定の一覧へ
          </a>
        }
      />
    </>
  );
}
