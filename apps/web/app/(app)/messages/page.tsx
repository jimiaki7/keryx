import type { Metadata } from 'next';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = { title: 'Messages' };

export default function MessagesPage() {
  return (
    <>
      <PageHeader
        title="Messages"
        description="説教・祈祷会奨励など、語る内容をここで管理します。"
      />
      <EmptyState
        title="Message はまだありません"
        description="Message の作成機能は現在準備中です。タイトルか聖書箇所だけで素早く保存できるようになります。"
      />
    </>
  );
}
