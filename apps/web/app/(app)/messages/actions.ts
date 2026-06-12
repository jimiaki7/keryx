'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';

/** 「新規作成」: 空のメッセージを作成して詳細ページで全項目を入力する */
export async function createDraftMessage(): Promise<void> {
  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  const { data: message, error } = await supabase
    .from('messages')
    .insert({ workspace_id: workspace.id, type: 'sermon', status: 'planned' })
    .select('id')
    .single();
  if (error || !message) {
    throw new Error('メッセージを作成できませんでした。');
  }
  revalidatePath('/messages');
  redirect(`/messages/${message.id}`);
}

/** メッセージを複製する（本文・聖書箇所をコピー。語る機会・準備段階は引き継がない） */
export async function duplicateMessage(messageId: string): Promise<void> {
  const workspace = await getActiveWorkspace();
  const supabase = await createClient();

  const { data: source } = await supabase
    .from('messages')
    .select(
      'type, title, central_message, summary, outline_markdown, notes_markdown, message_passages(role, position, book_id, start_chapter, start_verse, end_chapter, end_verse, display_text)',
    )
    .eq('id', messageId)
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!source) return;

  const { data: copy, error } = await supabase
    .from('messages')
    .insert({
      workspace_id: workspace.id,
      type: source.type,
      status: 'planned',
      title: source.title ? `${source.title}のコピー` : '',
      central_message: source.central_message,
      summary: source.summary,
      outline_markdown: source.outline_markdown,
      notes_markdown: source.notes_markdown,
    })
    .select('id')
    .single();
  if (error || !copy) {
    throw new Error('メッセージを複製できませんでした。');
  }

  if (source.message_passages.length > 0) {
    await supabase.from('message_passages').insert(
      source.message_passages.map((p) => ({
        message_id: copy.id,
        workspace_id: workspace.id,
        role: p.role,
        position: p.position,
        book_id: p.book_id,
        start_chapter: p.start_chapter,
        start_verse: p.start_verse,
        end_chapter: p.end_chapter,
        end_verse: p.end_verse,
        display_text: p.display_text,
      })),
    );
  }
  revalidatePath('/messages');
  redirect(`/messages/${copy.id}`);
}
