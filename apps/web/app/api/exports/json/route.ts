import { NextResponse } from 'next/server';
import { attachment, exportDateStamp, resolveExportContext } from '@/lib/export';

export async function GET(): Promise<NextResponse> {
  const ctx = await resolveExportContext();
  if (ctx instanceof NextResponse) return ctx;
  const { supabase, workspace } = ctx;

  const [messages, series, seriesMessages, gatherings, venues, deliveries, elements] =
    await Promise.all([
      supabase
        .from('messages')
        .select(
          'id, display_id, type, status, preparation_stage, title, central_message, summary, outline_markdown, notes_markdown, created_at, updated_at, message_passages(role, position, book_id, start_chapter, start_verse, end_chapter, end_verse, display_text)',
        )
        .eq('workspace_id', workspace.id)
        .is('deleted_at', null)
        .order('created_at'),
      supabase
        .from('series')
        .select('id, name, description, color, starts_on, ends_on, status, primary_book_id, goal')
        .eq('workspace_id', workspace.id)
        .is('deleted_at', null),
      supabase
        .from('series_messages')
        .select('series_id, message_id, position, planned_passage_text, notes')
        .eq('workspace_id', workspace.id),
      supabase
        .from('gatherings')
        .select(
          'id, display_id, title, kind, status, starts_at, ends_at, timezone, venue_id, audience, notes',
        )
        .eq('workspace_id', workspace.id)
        .is('deleted_at', null)
        .order('starts_at'),
      supabase
        .from('venues')
        .select('id, name, notes')
        .eq('workspace_id', workspace.id)
        .is('deleted_at', null),
      supabase
        .from('message_deliveries')
        .select('message_id, gathering_id, speaker_name, position, delivery_notes')
        .eq('workspace_id', workspace.id),
      supabase
        .from('service_elements')
        .select(
          'gathering_id, position, type, title, content, reference, assignee, duration_minutes, metadata',
        )
        .eq('workspace_id', workspace.id)
        .order('position'),
    ]);

  const failed = [messages, series, seriesMessages, gatherings, venues, deliveries, elements].find(
    (r) => r.error,
  );
  if (failed) {
    return NextResponse.json({ error: 'エクスポートに失敗しました。' }, { status: 500 });
  }

  const payload = {
    format: 'keryx-export',
    version: 1,
    exported_at: new Date().toISOString(),
    workspace: { name: workspace.name, slug: workspace.slug },
    messages: messages.data,
    series: series.data,
    series_messages: seriesMessages.data,
    gatherings: gatherings.data,
    venues: venues.data,
    message_deliveries: deliveries.data,
    service_elements: elements.data,
  };

  return attachment(
    `keryx-export-${exportDateStamp()}.json`,
    JSON.stringify(payload, null, 2),
    'application/json; charset=utf-8',
  );
}
