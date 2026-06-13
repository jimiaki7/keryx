import { NextResponse, type NextRequest } from 'next/server';
import { attachment, csvDocument, exportDateStamp, resolveExportContext } from '@/lib/export';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const entity = request.nextUrl.searchParams.get('entity') ?? 'messages';
  if (entity !== 'messages') {
    return NextResponse.json({ error: 'entity は messages を指定してください。' }, { status: 400 });
  }

  const ctx = await resolveExportContext();
  if (ctx instanceof NextResponse) return ctx;
  const { supabase, workspace } = ctx;

  const { data, error } = await supabase
    .from('messages')
    .select(
      'display_id, type, status, title, central_message, summary, created_at, message_passages(display_text, role, position)',
    )
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .order('created_at');
  if (error) return NextResponse.json({ error: 'エクスポートに失敗しました。' }, { status: 500 });

  const csv = csvDocument(
    ['表示ID', '種別', '状態', 'タイトル', '中心メッセージ', '概要', '聖書箇所', '作成日'],
    (data ?? []).map((m) => [
      m.display_id,
      m.type,
      m.status,
      m.title,
      m.central_message,
      m.summary,
      [...m.message_passages]
        .sort((a, b) => a.position - b.position)
        .map((p) => p.display_text)
        .join(' / '),
      m.created_at.slice(0, 10),
    ]),
  );
  return attachment(`keryx-messages-${exportDateStamp()}.csv`, csv, 'text/csv; charset=utf-8');
}
