import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { GATHERING_KIND_LABELS } from '@/lib/labels';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';
import { DeliveriesEditor, type DeliveryItem } from './deliveries-editor';
import { ElementsEditor, type ElementItem } from './elements-editor';
import { GatheringEditor } from './gathering-editor';

export const metadata: Metadata = { title: '礼拝予定' };

/** timestamptz を Asia/Tokyo の datetime-local 値（YYYY-MM-DDTHH:mm）へ */
function toLocalInputValue(iso: string): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
  return parts.replace(' ', 'T');
}

export default async function GatheringPlannerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const workspace = await getActiveWorkspace();
  const supabase = await createClient();

  const { data: gathering } = await supabase
    .from('gatherings')
    .select(
      'id, display_id, title, kind, status, starts_at, audience, notes, version, venues(name)',
    )
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!gathering) notFound();

  const [{ data: deliveriesRaw }, { data: elementsRaw }, { data: candidatesRaw }] =
    await Promise.all([
      supabase
        .from('message_deliveries')
        .select('id, speaker_name, messages!inner(id, display_id, title)')
        .eq('gathering_id', gathering.id)
        .order('position', { ascending: true }),
      supabase
        .from('service_elements')
        .select('id, type, title, position, metadata')
        .eq('gathering_id', gathering.id)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('messages')
        .select('id, display_id, title, message_deliveries(gathering_id)')
        .eq('workspace_id', workspace.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(200),
    ]);

  const deliveries: DeliveryItem[] = (deliveriesRaw ?? []).map((d) => ({
    id: d.id,
    speaker_name: d.speaker_name,
    message: { id: d.messages.id, display_id: d.messages.display_id, title: d.messages.title },
  }));

  const elements: ElementItem[] = (elementsRaw ?? []).map((e) => ({
    id: e.id,
    type: e.type,
    title: e.title,
    position: e.position,
    metadata: e.metadata as ElementItem['metadata'],
  }));

  const candidates = (candidatesRaw ?? [])
    .filter((m) => !m.message_deliveries.some((d) => d.gathering_id === gathering.id))
    .map((m) => ({ id: m.id, display_id: m.display_id, title: m.title }));

  return (
    <>
      <div className="mb-6">
        <Link href="/calendar" className="text-sm text-ink-muted hover:text-ink">
          ← カレンダー
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-indigo-deep">
          {gathering.title || GATHERING_KIND_LABELS[gathering.kind] || gathering.kind}
        </h1>
        <p className="mt-1 text-xs text-ink-muted">
          {gathering.display_id}
          {gathering.venues?.name ? ` ・ ${gathering.venues.name}` : ''}
        </p>
      </div>
      <div className="flex flex-col gap-5">
        <GatheringEditor
          gathering={{
            id: gathering.id,
            title: gathering.title,
            kind: gathering.kind,
            status: gathering.status,
            starts_at_local: toLocalInputValue(gathering.starts_at),
            venue_name: gathering.venues?.name ?? '',
            audience: gathering.audience,
            notes: gathering.notes,
            version: gathering.version,
          }}
        />
        <DeliveriesEditor
          gatheringId={gathering.id}
          deliveries={deliveries}
          candidates={candidates}
        />
        <ElementsEditor gatheringId={gathering.id} elements={elements} />
      </div>
    </>
  );
}
