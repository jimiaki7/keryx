import type { Metadata } from 'next';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { MessageList } from '@/components/message-list';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';
import { MessageCreateForm } from './message-create-form';

export const metadata: Metadata = { title: 'Inbox' };

export default async function InboxPage() {
  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, display_id, type, status, title, created_at, message_passages(display_text, role)')
    .eq('workspace_id', workspace.id)
    .eq('status', 'inbox')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  return (
    <>
      <PageHeader
        title="Inbox"
        description="思いついた説教の種を、日付を決める前にすぐ書き留める場所です。"
      />
      <div className="flex flex-col gap-6">
        <MessageCreateForm />
        {error ? (
          <div role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
            一覧を読み込めませんでした。再読み込みしてください。
          </div>
        ) : messages && messages.length > 0 ? (
          <MessageList messages={messages} />
        ) : (
          <EmptyState
            title="Inbox は空です"
            description="上のフォームから、タイトルか聖書箇所だけで保存できます。"
          />
        )}
      </div>
    </>
  );
}
