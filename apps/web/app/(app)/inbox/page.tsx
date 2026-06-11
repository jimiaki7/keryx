import type { Metadata } from 'next';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = { title: 'Inbox' };

export default function InboxPage() {
  return (
    <>
      <PageHeader
        title="Inbox"
        description="思いついた説教の種を、日付を決める前にすぐ書き留める場所です。"
      />
      <EmptyState
        title="Inbox は空です"
        description="Message の作成機能は現在準備中です。日付未定のまま保存したアイデアがここに並びます。"
      />
    </>
  );
}
