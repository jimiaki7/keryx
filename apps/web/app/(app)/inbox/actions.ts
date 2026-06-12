'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { preparationTemplateFor } from '@keryx/domain';
import { parsePassage } from '@keryx/scripture';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';

export type CreateMessageState = {
  ok?: boolean;
  nonce?: number;
  error?: string;
  suggestions?: readonly string[];
};

const createMessageSchema = z.object({
  type: z.enum(['sermon', 'prayer_meeting_exhortation', 'devotional', 'lecture', 'other']),
  title: z.string().trim().max(200, 'タイトルは200文字以内で入力してください。'),
  passage: z.string().trim().max(100, '聖書箇所は100文字以内で入力してください。'),
});

export async function createMessage(
  _prev: CreateMessageState,
  formData: FormData,
): Promise<CreateMessageState> {
  const parsed = createMessageSchema.safeParse({
    type: formData.get('type'),
    title: formData.get('title') ?? '',
    passage: formData.get('passage') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '入力内容をご確認ください。' };
  }
  const { type, title, passage } = parsed.data;

  if (!title && !passage) {
    return { error: 'タイトルか聖書箇所のどちらかを入力してください。' };
  }

  let range = null;
  if (passage) {
    const result = parsePassage(passage);
    if (!result.ok) {
      return {
        error: result.error.message,
        ...(result.error.suggestions ? { suggestions: result.error.suggestions } : {}),
      };
    }
    range = result.value;
  }

  const workspace = await getActiveWorkspace();
  const supabase = await createClient();

  const { data: message, error: messageError } = await supabase
    .from('messages')
    .insert({
      workspace_id: workspace.id,
      type,
      title: title || (range?.displayText ?? ''),
      status: 'inbox',
    })
    .select('id')
    .single();
  if (messageError || !message) {
    return { error: '保存できませんでした。通信状態を確認してもう一度お試しください。' };
  }

  if (range) {
    const { error: passageError } = await supabase.from('message_passages').insert({
      message_id: message.id,
      workspace_id: workspace.id,
      role: 'primary',
      position: 1,
      book_id: range.bookId,
      start_chapter: range.startChapter,
      start_verse: range.startVerse ?? null,
      end_chapter: range.endChapter,
      end_verse: range.endVerse ?? null,
      display_text: range.displayText,
    });
    if (passageError) {
      // Passage の保存に失敗した場合は Message を残さない（ソフトデリート）
      await supabase
        .from('messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', message.id);
      return { error: '聖書箇所を保存できませんでした。もう一度お試しください。' };
    }
  }

  // 種別に応じた準備タスクを生成する（KX-015。失敗しても Message 作成自体は成立させ、
  // 詳細画面の「準備タスクを生成」から再生成できる）
  const taskRows = preparationTemplateFor(type).map((title, i) => ({
    message_id: message.id,
    workspace_id: workspace.id,
    title,
    position: i + 1,
  }));
  await supabase.from('preparation_tasks').insert(taskRows);

  revalidatePath('/inbox');
  revalidatePath('/messages');
  return { ok: true, nonce: Date.now() };
}
