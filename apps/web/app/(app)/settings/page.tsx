import type { Metadata } from 'next';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = { title: '設定' };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="設定" description="Workspace・アカウント・表示の設定を行います。" />
      <EmptyState
        title="設定は準備中です"
        description="ログインと Workspace の機能が入ると、タイムゾーンや教会暦プリセットなどをここで設定できるようになります。"
      />
    </>
  );
}
