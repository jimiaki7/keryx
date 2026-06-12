import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { MESSAGE_TYPE_LABELS } from '@/lib/labels';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';
import { MessageDeleteButton, MessageEditor } from './message-editor';
import { PassageEditor } from './passage-editor';
import { SpeakingOpportunities, type OpportunityItem } from './speaking-opportunities';

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

  const passages = [...message.message_passages].sort(
    (a, b) => a.position - b.position || a.id.localeCompare(b.id),
  );

  const { data: deliveriesRaw } = await supabase
    .from('message_deliveries')
    .select(
      'id, speaker_name, gatherings!inner(id, display_id, title, kind, starts_at, deleted_at, venues(name))',
    )
    .eq('message_id', message.id)
    .order('created_at', { ascending: true });

  const opportunities: OpportunityItem[] = (deliveriesRaw ?? [])
    .filter((d) => d.gatherings.deleted_at === null)
    .map((d) => ({
      id: d.id,
      speaker_name: d.speaker_name,
      gathering: {
        id: d.gatherings.id,
        display_id: d.gatherings.display_id,
        title: d.gatherings.title,
        kind: d.gatherings.kind,
        starts_at: d.gatherings.starts_at,
        venue_name: d.gatherings.venues?.name ?? null,
      },
    }));

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
        <SpeakingOpportunities messageId={message.id} opportunities={opportunities} />
        <MessageEditor message={message} />
      </div>
    </>
  );
}
