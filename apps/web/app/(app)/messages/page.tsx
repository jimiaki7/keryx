import type { Metadata } from 'next';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { MessageList } from '@/components/message-list';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';

export const metadata: Metadata = { title: 'Messages' };

export default async function MessagesPage() {
  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, display_id, type, status, title, created_at, message_passages(display_text, role)')
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  return (
    <>
      <PageHeader
        title="Messages"
        description="説教・祈祷会奨励など、語る内容をここで管理します。"
      />
      {error ? (
        <div role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
          一覧を読み込めませんでした。再読み込みしてください。
        </div>
      ) : messages && messages.length > 0 ? (
        <MessageList messages={messages} />
      ) : (
        <EmptyState
          title="Message はまだありません"
          description="Inbox からタイトルか聖書箇所だけで素早く保存できます。"
        />
      )}
    </>
  );
}
