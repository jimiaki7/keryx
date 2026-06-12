import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { attachment, exportDateStamp, resolveExportContext } from '@/lib/export';
import { MESSAGE_STATUS_LABELS, MESSAGE_TYPE_LABELS } from '@/lib/labels';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const messageId = z.uuid().safeParse(request.nextUrl.searchParams.get('message'));
  if (!messageId.success) {
    return NextResponse.json({ error: 'message に UUID を指定してください。' }, { status: 400 });
  }

  const ctx = await resolveExportContext();
  if (ctx instanceof NextResponse) return ctx;
  const { supabase, workspace } = ctx;

  const { data: m } = await supabase
    .from('messages')
    .select(
      'display_id, type, status, title, central_message, summary, outline_markdown, notes_markdown, created_at, updated_at, message_passages(display_text, role, position)',
    )
    .eq('id', messageId.data)
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!m) {
    return NextResponse.json({ error: 'Message が見つかりません。' }, { status: 404 });
  }

  const passages = [...m.message_passages].sort((a, b) => a.position - b.position);
  const primary = passages.filter((p) => p.role === 'primary').map((p) => p.display_text);
  const supporting = passages.filter((p) => p.role === 'supporting').map((p) => p.display_text);

  const lines: string[] = [
    `# ${m.title || '（無題）'}`,
    '',
    `- 表示ID: ${m.display_id}`,
    `- 種別: ${MESSAGE_TYPE_LABELS[m.type] ?? m.type}`,
    `- 状態: ${MESSAGE_STATUS_LABELS[m.status] ?? m.status}`,
  ];
  if (primary.length > 0) lines.push(`- 聖書箇所: ${primary.join('、')}`);
  if (supporting.length > 0) lines.push(`- 補助箇所: ${supporting.join('、')}`);
  lines.push('');
  if (m.central_message) {
    lines.push('## 中心メッセージ', '', m.central_message, '');
  }
  if (m.summary) {
    lines.push('## 概要', '', m.summary, '');
  }
  if (m.outline_markdown) {
    lines.push('## アウトライン', '', m.outline_markdown, '');
  }
  if (m.notes_markdown) {
    lines.push('## ノート', '', m.notes_markdown, '');
  }

  const safeName = (m.display_id || 'message').replaceAll(/[^\w.-]/g, '_');
  return attachment(
    `${safeName}-${exportDateStamp()}.md`,
    lines.join('\n'),
    'text/markdown; charset=utf-8',
  );
}
