'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { parsePassage } from '@keryx/scripture';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';

export type UpdateMessageState = {
  ok?: boolean;
  nonce?: number;
  error?: string;
  conflict?: boolean;
  version?: number;
};

export type PassageFormState = {
  ok?: boolean;
  nonce?: number;
  error?: string;
  suggestions?: readonly string[];
};

const MESSAGE_TYPES = [
  'sermon',
  'prayer_meeting_exhortation',
  'devotional',
  'lecture',
  'other',
] as const;
const MESSAGE_STATUSES = [
  'inbox',
  'planned',
  'preparing',
  'ready',
  'completed',
  'archived',
] as const;

const updateMessageSchema = z.object({
  id: z.uuid(),
  version: z.coerce.number().int().min(1),
  type: z.enum(MESSAGE_TYPES),
  status: z.enum(MESSAGE_STATUSES),
  title: z.string().trim().max(200, 'タイトルは200文字以内で入力してください。'),
  central_message: z.string().trim().max(500, '中心メッセージは500文字以内で入力してください。'),
  summary: z.string().max(2000, '概要は2000文字以内で入力してください。'),
  outline_markdown: z.string().max(50000),
  notes_markdown: z.string().max(50000),
});

export async function updateMessage(
  _prev: UpdateMessageState,
  formData: FormData,
): Promise<UpdateMessageState> {
  const parsed = updateMessageSchema.safeParse({
    id: formData.get('id'),
    version: formData.get('version'),
    type: formData.get('type'),
    status: formData.get('status'),
    title: formData.get('title') ?? '',
    central_message: formData.get('central_message') ?? '',
    summary: formData.get('summary') ?? '',
    outline_markdown: formData.get('outline_markdown') ?? '',
    notes_markdown: formData.get('notes_markdown') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '入力内容をご確認ください。' };
  }
  const { id, version, ...fields } = parsed.data;

  const workspace = await getActiveWorkspace();
  const supabase = await createClient();

  // 楽観ロック: 読み込み時の version と一致する行だけを更新し、競合を黙って上書きしない
  const { data, error } = await supabase
    .from('messages')
    .update(fields)
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .eq('version', version)
    .is('deleted_at', null)
    .select('version')
    .maybeSingle();

  if (error) {
    return { error: '保存できませんでした。通信状態を確認してもう一度お試しください。' };
  }
  if (!data) {
    return {
      conflict: true,
      error:
        '他の画面でこの Message が更新されています。編集内容を控えたうえで、ページを再読み込みしてください。',
    };
  }

  revalidatePath(`/messages/${id}`);
  revalidatePath('/messages');
  revalidatePath('/inbox');
  return { ok: true, nonce: Date.now(), version: data.version };
}

export async function softDeleteMessage(formData: FormData): Promise<void> {
  const id = z.uuid().parse(formData.get('id'));
  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  await supabase
    .from('messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('workspace_id', workspace.id);
  revalidatePath('/messages');
  revalidatePath('/inbox');
  redirect('/messages');
}

// ---------------------------------------------------------------------------
// Passage
// ---------------------------------------------------------------------------

const passageInputSchema = z.object({
  text: z.string().trim().min(1, '聖書箇所を入力してください。').max(100),
  role: z.enum(['primary', 'supporting']),
});

function parseOrError(text: string) {
  const result = parsePassage(text);
  if (!result.ok) {
    return {
      error: result.error.message,
      ...(result.error.suggestions ? { suggestions: result.error.suggestions } : {}),
    } satisfies PassageFormState;
  }
  return result.value;
}

export async function addPassage(
  messageId: string,
  _prev: PassageFormState,
  formData: FormData,
): Promise<PassageFormState> {
  const parsed = passageInputSchema.safeParse({
    text: formData.get('text'),
    role: formData.get('role'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '入力内容をご確認ください。' };
  }
  const range = parseOrError(parsed.data.text);
  if ('error' in range) return range;

  const workspace = await getActiveWorkspace();
  const supabase = await createClient();

  const { data: maxRow } = await supabase
    .from('message_passages')
    .select('position')
    .eq('message_id', messageId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from('message_passages').insert({
    message_id: messageId,
    workspace_id: workspace.id,
    role: parsed.data.role,
    position: (maxRow?.position ?? 0) + 1,
    book_id: range.bookId,
    start_chapter: range.startChapter,
    start_verse: range.startVerse ?? null,
    end_chapter: range.endChapter,
    end_verse: range.endVerse ?? null,
    display_text: range.displayText,
  });
  if (error) {
    return { error: '聖書箇所を追加できませんでした。もう一度お試しください。' };
  }
  revalidatePath(`/messages/${messageId}`);
  return { ok: true, nonce: Date.now() };
}

export async function updatePassage(
  passageId: string,
  messageId: string,
  _prev: PassageFormState,
  formData: FormData,
): Promise<PassageFormState> {
  const parsed = passageInputSchema.safeParse({
    text: formData.get('text'),
    role: formData.get('role'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '入力内容をご確認ください。' };
  }
  const range = parseOrError(parsed.data.text);
  if ('error' in range) return range;

  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  const { error } = await supabase
    .from('message_passages')
    .update({
      role: parsed.data.role,
      book_id: range.bookId,
      start_chapter: range.startChapter,
      start_verse: range.startVerse ?? null,
      end_chapter: range.endChapter,
      end_verse: range.endVerse ?? null,
      display_text: range.displayText,
    })
    .eq('id', passageId)
    .eq('workspace_id', workspace.id);
  if (error) {
    return { error: '聖書箇所を更新できませんでした。もう一度お試しください。' };
  }
  revalidatePath(`/messages/${messageId}`);
  return { ok: true, nonce: Date.now() };
}

export async function deletePassage(passageId: string, messageId: string): Promise<void> {
  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  await supabase
    .from('message_passages')
    .delete()
    .eq('id', passageId)
    .eq('workspace_id', workspace.id);
  revalidatePath(`/messages/${messageId}`);
}

export async function movePassage(
  passageId: string,
  messageId: string,
  direction: 'up' | 'down',
): Promise<void> {
  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  const { data: passages } = await supabase
    .from('message_passages')
    .select('id, position')
    .eq('message_id', messageId)
    .eq('workspace_id', workspace.id)
    .order('position', { ascending: true });
  if (!passages) return;

  const index = passages.findIndex((p) => p.id === passageId);
  const neighborIndex = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || neighborIndex < 0 || neighborIndex >= passages.length) return;

  const current = passages[index]!;
  const neighbor = passages[neighborIndex]!;
  await supabase
    .from('message_passages')
    .update({ position: neighbor.position })
    .eq('id', current.id)
    .eq('workspace_id', workspace.id);
  await supabase
    .from('message_passages')
    .update({ position: current.position })
    .eq('id', neighbor.id)
    .eq('workspace_id', workspace.id);
  revalidatePath(`/messages/${messageId}`);
}
