import type { Metadata } from 'next';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = { title: 'シリーズ' };

export default function SeriesPage() {
  return (
    <>
      <PageHeader title="シリーズ" description="連続講解などの説教シリーズを計画します。" />
      <EmptyState
        title="シリーズはまだありません"
        description="シリーズの作成機能は現在準備中です。書巻ごとの連続講解の計画と実績をここで追えるようになります。"
      />
    </>
  );
}
