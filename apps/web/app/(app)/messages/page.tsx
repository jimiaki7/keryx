import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { MessageCreateForm } from '@/components/message-create-form';
import { MessageList } from '@/components/message-list';
import { MessagesTabs } from '@/components/messages-tabs';
import { PageHeader } from '@/components/page-header';
import { MESSAGE_STATUS_LABELS } from '@/lib/labels';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';

export const metadata: Metadata = { title: 'メッセージ' };

const FILTERS = ['all', 'planned', 'preparing', 'ready', 'completed', 'archived'];

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusParam } = await searchParams;
  const status = statusParam && FILTERS.includes(statusParam) ? statusParam : 'all';

  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  let query = supabase
    .from('messages')
    .select(
      'id, display_id, type, status, preparation_stage, title, created_at, message_passages(display_text, role)',
    )
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });
  if (status !== 'all') query = query.eq('status', status);
  const { data: messages, error } = await query;

  return (
    <>
      <PageHeader
        title="メッセージ"
        description="説教・祈祷会奨励と、その連続講解シリーズをここで管理します。"
      />
      <div className="flex flex-col gap-5">
        <MessagesTabs active="list" />
        <MessageCreateForm />

        <nav aria-label="状態で絞り込み" className="flex flex-wrap gap-1">
          {FILTERS.map((f) => {
            const active = f === status;
            const label = f === 'all' ? 'すべて' : (MESSAGE_STATUS_LABELS[f] ?? f);
            return (
              <Link
                key={f}
                href={f === 'all' ? '/messages' : `/messages?status=${f}`}
                aria-current={active ? 'page' : undefined}
                className={`rounded-full border px-3 py-1 text-sm ${
                  active
                    ? 'border-indigo-deep bg-indigo-deep text-paper-raised'
                    : 'border-line text-ink-muted hover:bg-indigo-deep/5'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {error ? (
          <div role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
            一覧を読み込めませんでした。再読み込みしてください。
          </div>
        ) : messages && messages.length > 0 ? (
          <MessageList messages={messages} />
        ) : (
          <EmptyState
            title={
              status === 'all'
                ? 'メッセージはまだありません'
                : `「${MESSAGE_STATUS_LABELS[status] ?? status}」のメッセージはありません`
            }
            description="上のフォームから、タイトルか聖書箇所だけで保存できます。"
          />
        )}
      </div>
    </>
  );
}
