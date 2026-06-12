'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { serviceTemplateFor } from '@/lib/service-templates';
import { findOrCreateVenue } from '@/lib/venues';
import { getActiveWorkspace } from '@/lib/workspace';

export type GatheringFormState = {
  ok?: boolean;
  nonce?: number;
  error?: string;
  conflict?: boolean;
  version?: number;
};

export type SimpleFormState = { ok?: boolean; nonce?: number; error?: string };

const GATHERING_KINDS = [
  'sunday_worship',
  'prayer_meeting',
  'special_service',
  'chapel',
  'other',
] as const;
const GATHERING_STATUSES = ['draft', 'scheduled', 'completed', 'canceled'] as const;
const ELEMENT_TYPES = [
  'call_to_worship',
  'hymn',
  'prayer',
  'responsive_reading',
  'scripture_reading',
  'message',
  'offering',
  'ceremony',
  'doxology',
  'benediction',
  'custom',
] as const;
const CEREMONY_TYPES = [
  'communion',
  'baptism',
  'transfer',
  'ordination',
  'memorial',
  'other',
] as const;

// datetime-local の値（例: 2026-06-14T10:30）。Workspace 既定の Asia/Tokyo として解釈する
const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function toTokyoTimestamp(local: string): string {
  return `${local}:00+09:00`;
}

// ---------------------------------------------------------------------------
// Gathering 作成・更新
// ---------------------------------------------------------------------------

const createGatheringSchema = z.object({
  title: z.string().trim().max(100),
  kind: z.enum(GATHERING_KINDS),
  starts_at_local: z.string().regex(LOCAL_DATETIME, '日時を入力してください。'),
  venue_name: z.string().trim().max(100),
});

export async function createGathering(
  _prev: GatheringFormState,
  formData: FormData,
): Promise<GatheringFormState> {
  const parsed = createGatheringSchema.safeParse({
    title: formData.get('title') ?? '',
    kind: formData.get('kind'),
    starts_at_local: formData.get('starts_at_local'),
    venue_name: formData.get('venue_name') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '入力内容をご確認ください。' };
  }
  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  const venueId = await findOrCreateVenue(supabase, workspace.id, parsed.data.venue_name);

  const { data, error } = await supabase
    .from('gatherings')
    .insert({
      workspace_id: workspace.id,
      title: parsed.data.title,
      kind: parsed.data.kind,
      starts_at: toTokyoTimestamp(parsed.data.starts_at_local),
      timezone: 'Asia/Tokyo',
      venue_id: venueId,
    })
    .select('id')
    .single();
  if (error || !data) {
    return { error: '礼拝予定を作成できませんでした。もう一度お試しください。' };
  }
  revalidatePath('/gatherings');
  redirect(`/gatherings/${data.id}`);
}

const updateGatheringSchema = z.object({
  id: z.uuid(),
  version: z.coerce.number().int().min(1),
  title: z.string().trim().max(100),
  kind: z.enum(GATHERING_KINDS),
  status: z.enum(GATHERING_STATUSES),
  starts_at_local: z.string().regex(LOCAL_DATETIME, '日時を入力してください。'),
  venue_name: z.string().trim().max(100),
  audience: z.string().trim().max(200),
  notes: z.string().max(5000),
});

export async function updateGathering(
  _prev: GatheringFormState,
  formData: FormData,
): Promise<GatheringFormState> {
  const parsed = updateGatheringSchema.safeParse({
    id: formData.get('id'),
    version: formData.get('version'),
    title: formData.get('title') ?? '',
    kind: formData.get('kind'),
    status: formData.get('status'),
    starts_at_local: formData.get('starts_at_local'),
    venue_name: formData.get('venue_name') ?? '',
    audience: formData.get('audience') ?? '',
    notes: formData.get('notes') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '入力内容をご確認ください。' };
  }
  const { id, version, venue_name, starts_at_local, ...fields } = parsed.data;

  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  const venueId = await findOrCreateVenue(supabase, workspace.id, venue_name);

  const { data, error } = await supabase
    .from('gatherings')
    .update({ ...fields, starts_at: toTokyoTimestamp(starts_at_local), venue_id: venueId })
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
        '他の画面でこの礼拝予定が更新されています。編集内容を控えたうえで、ページを再読み込みしてください。',
    };
  }
  revalidatePath(`/gatherings/${id}`);
  revalidatePath('/gatherings');
  return { ok: true, nonce: Date.now(), version: data.version };
}

// ---------------------------------------------------------------------------
// Message Delivery（関連 Message と説教者）
// ---------------------------------------------------------------------------

export async function addDelivery(
  gatheringId: string,
  _prev: SimpleFormState,
  formData: FormData,
): Promise<SimpleFormState> {
  const parsed = z
    .object({
      message_id: z.uuid('割り当てる Message を選択してください。'),
      speaker_name: z.string().trim().max(100),
    })
    .safeParse({
      message_id: formData.get('message_id'),
      speaker_name: formData.get('speaker_name') ?? '',
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '入力内容をご確認ください。' };
  }
  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  const { error } = await supabase.from('message_deliveries').insert({
    gathering_id: gatheringId,
    message_id: parsed.data.message_id,
    workspace_id: workspace.id,
    speaker_name: parsed.data.speaker_name,
  });
  if (error) {
    return {
      error:
        error.code === '23505'
          ? 'この Message はすでに割り当てられています。'
          : '割り当てできませんでした。もう一度お試しください。',
    };
  }
  revalidatePath(`/gatherings/${gatheringId}`);
  return { ok: true, nonce: Date.now() };
}

export async function removeDelivery(deliveryId: string, gatheringId: string): Promise<void> {
  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  await supabase
    .from('message_deliveries')
    .delete()
    .eq('id', deliveryId)
    .eq('workspace_id', workspace.id);
  revalidatePath(`/gatherings/${gatheringId}`);
}

// ---------------------------------------------------------------------------
// Service Elements（礼拝順序）
// ---------------------------------------------------------------------------

const elementInputSchema = z.object({
  type: z.enum(ELEMENT_TYPES),
  title: z.string().trim().max(200),
  ceremony_type: z.enum(CEREMONY_TYPES).or(z.literal('')),
});

export async function addElement(
  gatheringId: string,
  _prev: SimpleFormState,
  formData: FormData,
): Promise<SimpleFormState> {
  const parsed = elementInputSchema.safeParse({
    type: formData.get('type'),
    title: formData.get('title') ?? '',
    ceremony_type: formData.get('ceremony_type') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '入力内容をご確認ください。' };
  }
  const { type, title, ceremony_type } = parsed.data;
  if (type === 'custom' && !title) {
    return { error: 'その他の要素には名前を入力してください。' };
  }

  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  const { data: maxRow } = await supabase
    .from('service_elements')
    .select('position')
    .eq('gathering_id', gatheringId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const metadata = type === 'ceremony' && ceremony_type ? { ceremony_type } : {};
  const { error } = await supabase.from('service_elements').insert({
    gathering_id: gatheringId,
    workspace_id: workspace.id,
    position: (maxRow?.position ?? 0) + 1,
    type,
    title,
    metadata,
  });
  if (error) {
    return { error: '要素を追加できませんでした。もう一度お試しください。' };
  }
  revalidatePath(`/gatherings/${gatheringId}`);
  return { ok: true, nonce: Date.now() };
}

export async function updateElementTitle(
  elementId: string,
  gatheringId: string,
  _prev: SimpleFormState,
  formData: FormData,
): Promise<SimpleFormState> {
  const title = z
    .string()
    .trim()
    .max(200)
    .safeParse(formData.get('title') ?? '');
  if (!title.success) return { error: '内容は200文字以内で入力してください。' };

  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  const { error } = await supabase
    .from('service_elements')
    .update({ title: title.data })
    .eq('id', elementId)
    .eq('workspace_id', workspace.id);
  if (error) return { error: '更新できませんでした。もう一度お試しください。' };
  revalidatePath(`/gatherings/${gatheringId}`);
  return { ok: true, nonce: Date.now() };
}

export async function deleteElement(elementId: string, gatheringId: string): Promise<void> {
  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  await supabase
    .from('service_elements')
    .delete()
    .eq('id', elementId)
    .eq('workspace_id', workspace.id);
  revalidatePath(`/gatherings/${gatheringId}`);
}

export async function duplicateElement(elementId: string, gatheringId: string): Promise<void> {
  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  const { data: source } = await supabase
    .from('service_elements')
    .select('type, title, content, reference, assignee, duration_minutes, metadata, position')
    .eq('id', elementId)
    .eq('workspace_id', workspace.id)
    .maybeSingle();
  if (!source) return;

  // 元要素の直後に挿入する（次要素との中間 position。最後尾なら +1）
  const { data: next } = await supabase
    .from('service_elements')
    .select('position')
    .eq('gathering_id', gatheringId)
    .gt('position', source.position)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle();
  const position = next ? (source.position + next.position) / 2 : source.position + 1;

  await supabase
    .from('service_elements')
    .insert({ ...source, position, gathering_id: gatheringId, workspace_id: workspace.id });
  revalidatePath(`/gatherings/${gatheringId}`);
}

export async function moveElement(
  elementId: string,
  gatheringId: string,
  direction: 'up' | 'down',
): Promise<void> {
  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  const { data: elements } = await supabase
    .from('service_elements')
    .select('id, position')
    .eq('gathering_id', gatheringId)
    .eq('workspace_id', workspace.id)
    .order('position', { ascending: true });
  if (!elements) return;

  const index = elements.findIndex((e) => e.id === elementId);
  const neighborIndex = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || neighborIndex < 0 || neighborIndex >= elements.length) return;

  const current = elements[index]!;
  const neighbor = elements[neighborIndex]!;
  await supabase
    .from('service_elements')
    .update({ position: neighbor.position })
    .eq('id', current.id)
    .eq('workspace_id', workspace.id);
  await supabase
    .from('service_elements')
    .update({ position: current.position })
    .eq('id', neighbor.id)
    .eq('workspace_id', workspace.id);
  revalidatePath(`/gatherings/${gatheringId}`);
}

// ---------------------------------------------------------------------------
// 礼拝テンプレート適用（KX-014）
// ---------------------------------------------------------------------------

export async function applyServiceTemplate(
  gatheringId: string,
  _prev: SimpleFormState,
  formData: FormData,
): Promise<SimpleFormState> {
  const key = z.string().safeParse(formData.get('template'));
  const template = key.success ? serviceTemplateFor(key.data) : undefined;
  if (!template) return { error: 'テンプレートを選択してください。' };

  const workspace = await getActiveWorkspace();
  const supabase = await createClient();

  // 適用は既存要素の置き換え。確認はクライアント側ダイアログ（既存要素がある場合）で行う。
  // データを失わないため「先に新要素を挿入し、成功した場合だけ旧要素を削除する」順序にする
  // （挿入が失敗しても既存の礼拝順序はそのまま残る）。
  const { data: oldRows, error: fetchError } = await supabase
    .from('service_elements')
    .select('id, position')
    .eq('gathering_id', gatheringId)
    .eq('workspace_id', workspace.id);
  if (fetchError) {
    return { error: 'テンプレートを適用できませんでした。もう一度お試しください。' };
  }

  const basePosition =
    oldRows && oldRows.length > 0 ? Math.max(...oldRows.map((r) => r.position)) : 0;
  const rows = template.elements.map((el, i) => ({
    gathering_id: gatheringId,
    workspace_id: workspace.id,
    position: basePosition + i + 1,
    type: el.type,
    title: el.title,
  }));
  const { error: insertError } = await supabase.from('service_elements').insert(rows);
  if (insertError) {
    return { error: 'テンプレートを適用できませんでした。既存の礼拝順序は変更されていません。' };
  }

  if (oldRows && oldRows.length > 0) {
    const { error: deleteError } = await supabase
      .from('service_elements')
      .delete()
      .in(
        'id',
        oldRows.map((r) => r.id),
      )
      .eq('workspace_id', workspace.id);
    if (deleteError) {
      return {
        error:
          '以前の要素の削除に失敗しました。テンプレートの要素は追加済みです。残った要素を手動で削除してください。',
      };
    }
  }
  revalidatePath(`/gatherings/${gatheringId}`);
  return { ok: true, nonce: Date.now() };
}
