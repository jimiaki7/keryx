import type { Metadata } from 'next';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = { title: 'カレンダー' };

export default function CalendarPage() {
  return (
    <>
      <PageHeader title="カレンダー" description="月間・年間の礼拝予定と教会暦を見渡します。" />
      <EmptyState
        title="カレンダーは準備中です"
        description="礼拝予定（Gathering）を登録できるようになると、ここに月間カレンダーが表示されます。"
      />
    </>
  );
}
