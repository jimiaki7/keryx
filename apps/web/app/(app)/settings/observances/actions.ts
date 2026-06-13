'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { liturgicalObservances } from '@keryx/domain';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';

export type ObservanceFormState = { ok?: boolean; nonce?: number; error?: string };

const PLANNER_ROLES = ['owner', 'pastor', 'planner'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const observanceSchema = z
  .object({
    name: z.string().trim().min(1, '名称を入力してください。').max(80),
    starts_on: z.string().regex(DATE_RE, '開始日を入力してください。'),
    ends_on: z.string().regex(DATE_RE, '終了日を入力してください。'),
    color: z.string().trim().max(20),
  })
  .refine((v) => v.ends_on >= v.starts_on, {
    message: '終了日は開始日以降にしてください。',
    path: ['ends_on'],
  });

/** 指定年の教会暦プリセットを適用する（再適用しても重複しない。既存・削除済みは保持） */
export async function applyObservancePreset(formData: FormData): Promise<void> {
  const year = Number(formData.get('year'));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return;
  const workspace = await getActiveWorkspace();
  if (!PLANNER_ROLES.includes(workspace.role)) return;

  const supabase = await createClient();
  const rows = liturgicalObservances(year).map((o) => ({
    workspace_id: workspace.id,
    name: o.name,
    kind: o.kind,
    starts_on: o.startsOn,
    ends_on: o.endsOn,
    color: o.color,
    source: 'preset' as const,
    preset_key: o.presetKey,
  }));
  await supabase
    .from('observances')
    .upsert(rows, { onConflict: 'workspace_id,preset_key', ignoreDuplicates: true });
  revalidatePath('/settings/observances');
  revalidatePath('/calendar');
}

/** 独自の Observance を追加する */
export async function addObservance(
  _prev: ObservanceFormState,
  formData: FormData,
): Promise<ObservanceFormState> {
  const parsed = observanceSchema.safeParse({
    name: formData.get('name') ?? '',
    starts_on: formData.get('starts_on') ?? '',
    ends_on: formData.get('ends_on') ?? '',
    color: formData.get('color') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '入力内容をご確認ください。' };
  }
  const workspace = await getActiveWorkspace();
  if (!PLANNER_ROLES.includes(workspace.role)) {
    return { error: 'この操作の権限がありません。' };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('observances').insert({
    workspace_id: workspace.id,
    name: parsed.data.name,
    kind: 'custom',
    starts_on: parsed.data.starts_on,
    ends_on: parsed.data.ends_on,
    color: parsed.data.color,
    source: 'workspace',
  });
  if (error) {
    return { error: '追加できませんでした。もう一度お試しください。' };
  }
  revalidatePath('/settings/observances');
  revalidatePath('/calendar');
  return { ok: true, nonce: Date.now() };
}

/** Observance を更新する（名称変更・日付・色）。失敗時も例外にせず黙って戻る（フォームは native 検証前提） */
export async function updateObservance(id: string, formData: FormData): Promise<void> {
  const parsedId = z.uuid().safeParse(id);
  const parsed = observanceSchema.safeParse({
    name: formData.get('name') ?? '',
    starts_on: formData.get('starts_on') ?? '',
    ends_on: formData.get('ends_on') ?? '',
    color: formData.get('color') ?? '',
  });
  if (!parsedId.success || !parsed.success) return;
  const workspace = await getActiveWorkspace();
  if (!PLANNER_ROLES.includes(workspace.role)) return;
  const supabase = await createClient();
  await supabase
    .from('observances')
    .update({
      name: parsed.data.name,
      starts_on: parsed.data.starts_on,
      ends_on: parsed.data.ends_on,
      color: parsed.data.color,
    })
    .eq('id', parsedId.data)
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null);
  revalidatePath('/settings/observances');
  revalidatePath('/calendar');
}

/** Observance をソフトデリートする */
export async function deleteObservance(id: string): Promise<void> {
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) return;
  const workspace = await getActiveWorkspace();
  if (!PLANNER_ROLES.includes(workspace.role)) return;
  const supabase = await createClient();
  await supabase
    .from('observances')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', parsedId.data)
    .eq('workspace_id', workspace.id);
  revalidatePath('/settings/observances');
  revalidatePath('/calendar');
}
