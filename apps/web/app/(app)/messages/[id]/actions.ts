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

const GATHERING_KINDS = [
  'sunday_worship',
  'prayer_meeting',
  'special_service',
  'chapel',
  'other',
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
  // 語る機会（任意。日時が入力されたときだけ Gathering+Delivery を作成する）
  opp_starts_at_local: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    .or(z.literal('')),
  opp_kind: z.enum(GATHERING_KINDS),
  opp_venue: z.string().trim().max(100),
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
    opp_starts_at_local: formData.get('opp_starts_at_local') ?? '',
    opp_kind: formData.get('opp_kind') ?? 'sunday_worship',
    opp_venue: formData.get('opp_venue') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '入力内容をご確認ください。' };
  }
  const { id, version, opp_starts_at_local, opp_kind, opp_venue, ...fields } = parsed.data;

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

  // 語る機会の日時が入力されていれば、Gathering を作成して関連付ける
  if (opp_starts_at_local) {
    const venueId = await findOrCreateVenue(supabase, workspace.id, opp_venue);
    const { data: gathering, error: gatheringError } = await supabase
      .from('gatherings')
      .insert({
        workspace_id: workspace.id,
        kind: opp_kind,
        starts_at: `${opp_starts_at_local}:00+09:00`,
        timezone: 'Asia/Tokyo',
        venue_id: venueId,
      })
      .select('id')
      .single();
    if (gatheringError || !gathering) {
      return {
        version: data.version,
        error: '本文は保存しましたが、語る機会を追加できませんでした。もう一度お試しください。',
      };
    }
    const { error: deliveryError } = await supabase.from('message_deliveries').insert({
      message_id: id,
      gathering_id: gathering.id,
      workspace_id: workspace.id,
    });
    if (deliveryError) {
      await supabase
        .from('gatherings')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', gathering.id);
      return {
        version: data.version,
        error: '本文は保存しましたが、語る機会を追加できませんでした。もう一度お試しください。',
      };
    }
    revalidatePath('/calendar');
    revalidatePath('/');
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
// 語る機会（作成は updateMessage の保存に統合。ここは削除のみ）
// ---------------------------------------------------------------------------

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
// 別の場所でも語る（Jimi 方針: 1説教=1礼拝を保ち、再説教は内容を複製して場所を変える。
// 同一 Message に複数 Delivery をぶら下げるのではなく、独立した Message を作る）
// ---------------------------------------------------------------------------

export type PreachElsewhereState = { error?: string };

const preachElsewhereSchema = z.object({
  starts_at_local: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, '日時を入力してください。'),
  kind: z.enum(GATHERING_KINDS),
  venue: z.string().trim().min(1, '会場を入力してください。').max(100),
});

export async function preachElsewhere(
  messageId: string,
  _prev: PreachElsewhereState,
  formData: FormData,
): Promise<PreachElsewhereState> {
  if (!z.uuid().safeParse(messageId).success) return { error: '対象が不正です。' };
  const parsed = preachElsewhereSchema.safeParse({
    starts_at_local: formData.get('starts_at_local') ?? '',
    kind: formData.get('kind') ?? 'sunday_worship',
    venue: formData.get('venue') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '入力内容をご確認ください。' };
  }

  const workspace = await getActiveWorkspace();
  const supabase = await createClient();

  // 元メッセージの内容を読み込む（聖書箇所も複製する。題は同一＝同じ説教）
  const { data: source } = await supabase
    .from('messages')
    .select(
      'type, title, central_message, summary, outline_markdown, notes_markdown, message_passages(role, position, book_id, start_chapter, start_verse, end_chapter, end_verse, display_text)',
    )
    .eq('id', messageId)
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!source) return { error: '元のメッセージが見つかりません。' };

  // 内容を複製（再説教で多少手を入れる前提。準備段階・状態は新たに開始）
  const { data: copy, error: copyError } = await supabase
    .from('messages')
    .insert({
      workspace_id: workspace.id,
      type: source.type,
      status: 'planned',
      title: source.title,
      central_message: source.central_message,
      summary: source.summary,
      outline_markdown: source.outline_markdown,
      notes_markdown: source.notes_markdown,
    })
    .select('id')
    .single();
  if (copyError || !copy) return { error: '複製できませんでした。もう一度お試しください。' };

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

  // 新しい場所・日時で礼拝予定と配信を作る。失敗時は複製をソフトデリートして巻き戻す。
  const venueId = await findOrCreateVenue(supabase, workspace.id, parsed.data.venue);
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
    await supabase
      .from('messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', copy.id)
      .eq('workspace_id', workspace.id);
    return { error: '複製しましたが、礼拝予定を作成できませんでした。もう一度お試しください。' };
  }
  const { error: deliveryError } = await supabase.from('message_deliveries').insert({
    message_id: copy.id,
    gathering_id: gathering.id,
    workspace_id: workspace.id,
  });
  if (deliveryError) {
    await supabase
      .from('gatherings')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', gathering.id);
    await supabase
      .from('messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', copy.id)
      .eq('workspace_id', workspace.id);
    return { error: '複製しましたが、関連付けに失敗しました。もう一度お試しください。' };
  }

  revalidatePath('/messages');
  revalidatePath('/calendar');
  revalidatePath('/');
  redirect(`/messages/${copy.id}`);
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
