import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { SERIES_STATUS_LABELS } from '@/lib/labels';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';
import { SeriesEditor } from './series-editor';
import { SeriesMessagesEditor, type SeriesMessageEntry } from './series-messages-editor';

export const metadata: Metadata = { title: 'シリーズ' };

export default async function SeriesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const workspace = await getActiveWorkspace();
  const supabase = await createClient();

  const { data: series } = await supabase
    .from('series')
    .select(
      'id, name, description, goal, status, color, starts_on, ends_on, primary_book_id, version',
    )
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!series) notFound();

  const [{ data: entriesRaw }, { data: candidatesRaw }, { data: books }] = await Promise.all([
    supabase
      .from('series_messages')
      .select('id, position, messages!inner(id, display_id, title, status, deleted_at)')
      .eq('series_id', series.id)
      .order('position', { ascending: true }),
    supabase
      .from('messages')
      .select('id, display_id, title, series_messages(series_id)')
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('bible_books').select('osis, name_ja').order('canonical_order'),
  ]);

  const entries: SeriesMessageEntry[] = (entriesRaw ?? [])
    .filter((e) => e.messages.deleted_at === null)
    .map((e) => ({
      id: e.id,
      position: e.position,
      message: {
        id: e.messages.id,
        display_id: e.messages.display_id,
        title: e.messages.title,
        status: e.messages.status,
      },
    }));

  const candidates = (candidatesRaw ?? [])
    .filter((m) => !m.series_messages.some((sm) => sm.series_id === series.id))
    .map((m) => ({ id: m.id, display_id: m.display_id, title: m.title }));

  return (
    <>
      <div className="mb-6">
        <Link href="/messages/series" className="text-sm text-ink-muted hover:text-ink">
          ← シリーズ
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-indigo-deep">{series.name}</h1>
        <p className="mt-1 text-xs text-ink-muted">
          {SERIES_STATUS_LABELS[series.status] ?? series.status} ・ {entries.length} 件
        </p>
      </div>
      <div className="flex flex-col gap-5">
        <SeriesMessagesEditor seriesId={series.id} entries={entries} candidates={candidates} />
        <SeriesEditor series={series} books={books ?? []} />
      </div>
    </>
  );
}
