import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { MESSAGE_TYPE_LABELS } from '@/lib/labels';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';
import { MessageDeleteButton, MessageEditor } from './message-editor';
import { PassageEditor } from './passage-editor';

export const metadata: Metadata = { title: 'Message' };

export default async function MessageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  const { data: message } = await supabase
    .from('messages')
    .select(
      'id, display_id, type, status, title, central_message, summary, outline_markdown, notes_markdown, version, updated_at, message_passages(id, role, position, display_text)',
    )
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!message) notFound();

  const passages = [...message.message_passages].sort((a, b) => a.position - b.position);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/messages" className="text-sm text-ink-muted hover:text-ink">
            ← Messages
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-indigo-deep">
            {message.title || '（無題）'}
          </h1>
          <p className="mt-1 text-xs text-ink-muted">
            {message.display_id} ・ {MESSAGE_TYPE_LABELS[message.type] ?? message.type}
          </p>
        </div>
        <MessageDeleteButton messageId={message.id} />
      </div>
      <div className="flex flex-col gap-5">
        <PassageEditor messageId={message.id} passages={passages} />
        <MessageEditor message={message} />
      </div>
    </>
  );
}
