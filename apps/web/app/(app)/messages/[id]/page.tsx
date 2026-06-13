import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { ElementsEditor, type ElementItem } from '@/app/(app)/gatherings/[id]/elements-editor';
import { aiConfigured } from '@/lib/ai/claude';
import { GATHERING_KIND_LABELS, MESSAGE_TYPE_LABELS } from '@/lib/labels';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';
import { AiSuggestions, type PendingSuggestion } from './ai-suggestions';
import { MessageDeleteButton, MessageEditor, type OpportunityItem } from './message-editor';
import { PassageEditor } from './passage-editor';
import { PreachElsewhere } from './preach-elsewhere';
import { PreparationStageControl } from './preparation-stage';

export const metadata: Metadata = { title: 'メッセージ' };

/** 埋め込む礼拝順序エディタの見出しに、どの礼拝予定かを示すラベルを作る。 */
function gatheringCaption(o: OpportunityItem): string {
  const label = o.gathering.title || GATHERING_KIND_LABELS[o.gathering.kind] || o.gathering.kind;
  const date = new Date(o.gathering.starts_at).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });
  return o.gathering.venue_name
    ? `${label}・${date}・${o.gathering.venue_name}`
    : `${label}・${date}`;
}

export default async function MessageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  const { data: message } = await supabase
    .from('messages')
    .select(
      'id, display_id, type, status, preparation_stage, title, central_message, summary, outline_markdown, notes_markdown, version, updated_at, message_passages(id, role, position, display_text)',
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

  const { data: venues } = await supabase
    .from('venues')
    .select('id, name')
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  const { data: suggestionRows } = await supabase
    .from('ai_suggestions')
    .select('id, kind, content, model')
    .eq('message_id', message.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  const suggestions: PendingSuggestion[] = suggestionRows ?? [];

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

  // 礼拝順序（service_elements）は gathering に属する。メッセージ詳細では、
  // 紐づく礼拝予定ごとに順序エディタを埋め込む（データは gathering 側に保存）。
  const elementsByGathering = new Map<string, ElementItem[]>();
  const gatheringIds = opportunities.map((o) => o.gathering.id);
  if (gatheringIds.length > 0) {
    const { data: elementsRaw } = await supabase
      .from('service_elements')
      .select('id, type, title, position, metadata, gathering_id')
      .in('gathering_id', gatheringIds)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });
    for (const e of elementsRaw ?? []) {
      const list = elementsByGathering.get(e.gathering_id) ?? [];
      list.push({
        id: e.id,
        type: e.type,
        title: e.title,
        position: e.position,
        metadata: e.metadata as ElementItem['metadata'],
      });
      elementsByGathering.set(e.gathering_id, list);
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/messages" className="text-sm text-ink-muted hover:text-ink">
            ← メッセージ
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-indigo-deep">
            {message.title || '（無題）'}
          </h1>
          <p className="mt-1 text-xs text-ink-muted">
            {message.display_id} ・ {MESSAGE_TYPE_LABELS[message.type] ?? message.type}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/exports/markdown?message=${message.id}`}
            download
            className="rounded-md border border-line px-3 py-1.5 text-sm text-indigo-deep hover:bg-indigo-deep/5"
          >
            Markdown出力
          </a>
          <MessageDeleteButton messageId={message.id} />
        </div>
      </div>
      <div className="flex flex-col gap-5">
        <PassageEditor messageId={message.id} passages={passages} />
        <PreparationStageControl messageId={message.id} stage={message.preparation_stage} />
        <MessageEditor message={message} opportunities={opportunities} venues={venues ?? []} />
        {opportunities.length > 0 ? (
          opportunities.map((o) => (
            <ElementsEditor
              key={o.gathering.id}
              gatheringId={o.gathering.id}
              elements={elementsByGathering.get(o.gathering.id) ?? []}
              caption={gatheringCaption(o)}
            />
          ))
        ) : (
          <section
            aria-label="礼拝順序"
            className="rounded-lg border border-line bg-paper-raised p-4"
          >
            <h2 className="text-sm font-medium text-ink">礼拝順序</h2>
            <p className="mt-2 text-sm text-ink-muted">
              招詞・賛美・交読文・式典などの礼拝順序は、上の「語る機会」で礼拝予定を追加すると入力できます。
            </p>
          </section>
        )}
        <AiSuggestions
          messageId={message.id}
          configured={aiConfigured()}
          suggestions={suggestions}
        />
        <PreachElsewhere messageId={message.id} venues={venues ?? []} />
      </div>
    </>
  );
}
