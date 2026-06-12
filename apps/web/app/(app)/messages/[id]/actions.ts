'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { isPreparationStage } from '@keryx/domain';
import { parsePassage } from '@keryx/scripture';
import { createClient } from '@/lib/supabase/server';
import { findOrCreateVenue } from '@/lib/venues';
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
        '他の画面でこのメッセージが更新されています。編集内容を控えたうえで、ページを再読み込みしてください。',
    };
  }

  revalidatePath(`/messages/${id}`);
  revalidatePath('/messages');
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

// ---------------------------------------------------------------------------
// 語る機会（Gathering を作成して Delivery で関連付ける。KX-012）
// ---------------------------------------------------------------------------

export type OpportunityFormState = { ok?: boolean; nonce?: number; error?: string };

const opportunitySchema = z.object({
  starts_at_local: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, '日時を入力してください。'),
  kind: z.enum(['sunday_worship', 'prayer_meeting', 'special_service', 'chapel', 'other']),
  venue_name: z.string().trim().max(100),
  speaker_name: z.string().trim().max(100),
});

export async function addSpeakingOpportunity(
  messageId: string,
  _prev: OpportunityFormState,
  formData: FormData,
): Promise<OpportunityFormState> {
  const parsed = opportunitySchema.safeParse({
    starts_at_local: formData.get('starts_at_local'),
    kind: formData.get('kind'),
    venue_name: formData.get('venue_name') ?? '',
    speaker_name: formData.get('speaker_name') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '入力内容をご確認ください。' };
  }
  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  const venueId = await findOrCreateVenue(supabase, workspace.id, parsed.data.venue_name);

  const { data: gathering, error: gatheringError } = await supabase
    .from('gatherings')
    .insert({
      workspace_id: workspace.id,
      kind: parsed.data.kind,
      starts_at: `${parsed.data.starts_at_local}:00+09:00`,
      timezone: 'Asia/Tokyo',
      venue_id: venueId,
    })
    .select('id')
    .single();
  if (gatheringError || !gathering) {
    return { error: '語る機会を作成できませんでした。もう一度お試しください。' };
  }

  const { error: deliveryError } = await supabase.from('message_deliveries').insert({
    message_id: messageId,
    gathering_id: gathering.id,
    workspace_id: workspace.id,
    speaker_name: parsed.data.speaker_name,
  });
  if (deliveryError) {
    // Delivery に失敗した場合は作成した Gathering を残さない
    await supabase
      .from('gatherings')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', gathering.id);
    return { error: '語る機会を関連付けられませんでした。もう一度お試しください。' };
  }
  revalidatePath(`/messages/${messageId}`);
  revalidatePath('/calendar');
  return { ok: true, nonce: Date.now() };
}

export async function removeSpeakingOpportunity(
  deliveryId: string,
  messageId: string,
): Promise<void> {
  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  await supabase
    .from('message_deliveries')
    .delete()
    .eq('id', deliveryId)
    .eq('workspace_id', workspace.id);
  revalidatePath(`/messages/${messageId}`);
}

// ---------------------------------------------------------------------------
// 準備段階（ADR-0003: 単一ステージ）
// ---------------------------------------------------------------------------

export async function setPreparationStage(messageId: string, stage: string): Promise<void> {
  if (!isPreparationStage(stage)) return;
  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  await supabase
    .from('messages')
    .update({ preparation_stage: stage })
    .eq('id', messageId)
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null);
  revalidatePath(`/messages/${messageId}`);
  revalidatePath('/messages');
  revalidatePath('/');
}

/** 既存の礼拝予定（Gathering）へこのメッセージを割り当てる */
export async function assignMessageToGathering(
  messageId: string,
  _prev: OpportunityFormState,
  formData: FormData,
): Promise<OpportunityFormState> {
  const gatheringId = z.uuid().safeParse(formData.get('gathering_id'));
  if (!gatheringId.success) {
    return { error: '割り当てる礼拝予定を選択してください。' };
  }
  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  const { error } = await supabase.from('message_deliveries').insert({
    message_id: messageId,
    gathering_id: gatheringId.data,
    workspace_id: workspace.id,
  });
  if (error) {
    return {
      error:
        error.code === '23505'
          ? 'この礼拝予定にはすでに割り当てられています。'
          : '割り当てできませんでした。もう一度お試しください。',
    };
  }
  revalidatePath(`/messages/${messageId}`);
  revalidatePath('/calendar');
  revalidatePath('/');
  return { ok: true, nonce: Date.now() };
}
