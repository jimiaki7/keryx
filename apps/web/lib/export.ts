import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export type ExportContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  workspace: { id: string; name: string; slug: string };
};

/**
 * エクスポート用の認証・Workspace解決。
 * 未ログインは 401。Workspace スコープは必ずここで確定し、全クエリで明示する
 * （RLS との二重防御。他 Workspace のデータを混入させない: KX-018）。
 */
export async function resolveExportContext(): Promise<ExportContext | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 });
  }
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces!inner(id, name, slug)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: 'Workspace が見つかりません。' }, { status: 404 });
  }
  const ws = membership.workspaces;
  return { supabase, workspace: { id: ws.id, name: ws.name, slug: ws.slug } };
}

/** CSV フィールドのエスケープ（RFC 4180。先頭の = + - @ はスプレッドシートでの数式実行を防ぐ） */
export function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (/^[=+\-@\t]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replaceAll('"', '""')}"`;
  return s;
}

export function csvDocument(
  header: readonly string[],
  rows: readonly (readonly unknown[])[],
): string {
  const lines = [header.map((h) => csvField(h)).join(',')];
  for (const row of rows) {
    lines.push(row.map((v) => csvField(v as string | number | null | undefined)).join(','));
  }
  // BOM 付き UTF-8（Excel で日本語が文字化けしないように）
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export function attachment(filename: string, body: string, contentType: string): NextResponse {
  return new NextResponse(body, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

export function exportDateStamp(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' })
    .format(new Date())
    .replaceAll('-', '');
}
