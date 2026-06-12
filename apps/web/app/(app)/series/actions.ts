'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';

export type SeriesFormState = {
  ok?: boolean;
  nonce?: number;
  error?: string;
  conflict?: boolean;
  version?: number;
};

const SERIES_STATUSES = ['planned', 'active', 'paused', 'completed', 'archived'] as const;

const seriesFieldsSchema = z.object({
  name: z.string().trim().min(1, 'シリーズ名を入力してください。').max(100),
  description: z.string().trim().max(2000),
  goal: z.string().trim().max(1000),
  status: z.enum(SERIES_STATUSES),
  color: z.string().trim().max(20),
  starts_on: z.string().trim(),
  ends_on: z.string().trim(),
  primary_book_id: z.string().trim().max(10),
});

function toDateOrNull(value: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function fieldsFromForm(formData: FormData) {
  const parsed = seriesFieldsSchema.safeParse({
    name: formData.get('name') ?? '',
    description: formData.get('description') ?? '',
    goal: formData.get('goal') ?? '',
    status: formData.get('status') ?? 'active',
    color: formData.get('color') ?? '',
    starts_on: formData.get('starts_on') ?? '',
    ends_on: formData.get('ends_on') ?? '',
    primary_book_id: formData.get('primary_book_id') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '入力内容をご確認ください。' } as const;
  }
  const f = parsed.data;
  const starts = toDateOrNull(f.starts_on);
  const ends = toDateOrNull(f.ends_on);
  if (starts && ends && ends < starts) {
    return { error: '終了日は開始日より後にしてください。' } as const;
  }
  return {
    fields: {
      name: f.name,
      description: f.description,
      goal: f.goal,
      status: f.status,
      color: f.color,
      starts_on: starts,
      ends_on: ends,
      primary_book_id: f.primary_book_id || null,
    },
  } as const;
}

export async function createSeries(
  _prev: SeriesFormState,
  formData: FormData,
): Promise<SeriesFormState> {
  const result = fieldsFromForm(formData);
  if ('error' in result) return { error: result.error };

  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('series')
    .insert({ workspace_id: workspace.id, ...result.fields })
    .select('id')
    .single();
  if (error || !data) {
    return { error: 'シリーズを作成できませんでした。もう一度お試しください。' };
  }
  revalidatePath('/series');
  redirect(`/series/${data.id}`);
}

export async function updateSeries(
  _prev: SeriesFormState,
  formData: FormData,
): Promise<SeriesFormState> {
  const id = z.uuid().safeParse(formData.get('id'));
  const version = z.coerce.number().int().min(1).safeParse(formData.get('version'));
  if (!id.success || !version.success) return { error: '入力内容をご確認ください。' };
  const result = fieldsFromForm(formData);
  if ('error' in result) return { error: result.error };

  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  // 楽観ロック（messages と同じ方式）
  const { data, error } = await supabase
    .from('series')
    .update(result.fields)
    .eq('id', id.data)
    .eq('workspace_id', workspace.id)
    .eq('version', version.data)
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
        '他の画面でこのシリーズが更新されています。編集内容を控えたうえで、ページを再読み込みしてください。',
    };
  }
  revalidatePath(`/series/${id.data}`);
  revalidatePath('/series');
  return { ok: true, nonce: Date.now(), version: data.version };
}

// ---------------------------------------------------------------------------
// シリーズ内 Message（追加・削除・並べ替え）
// ---------------------------------------------------------------------------

export type SeriesMessageState = { ok?: boolean; nonce?: number; error?: string };

export async function addMessageToSeries(
  seriesId: string,
  _prev: SeriesMessageState,
  formData: FormData,
): Promise<SeriesMessageState> {
  const messageId = z.uuid().safeParse(formData.get('message_id'));
  if (!messageId.success) return { error: '追加する Message を選択してください。' };

  const workspace = await getActiveWorkspace();
  const supabase = await createClient();

  const { data: maxRow } = await supabase
    .from('series_messages')
    .select('position')
    .eq('series_id', seriesId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from('series_messages').insert({
    series_id: seriesId,
    message_id: messageId.data,
    workspace_id: workspace.id,
    position: (maxRow?.position ?? 0) + 1,
  });
  if (error) {
    return {
      error:
        error.code === '23505'
          ? 'この Message はすでにシリーズに追加されています。'
          : '追加できませんでした。もう一度お試しください。',
    };
  }
  revalidatePath(`/series/${seriesId}`);
  return { ok: true, nonce: Date.now() };
}

export async function removeSeriesMessage(entryId: string, seriesId: string): Promise<void> {
  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  // シリーズから外すだけで Message 自体は削除しない
  await supabase
    .from('series_messages')
    .delete()
    .eq('id', entryId)
    .eq('workspace_id', workspace.id);
  revalidatePath(`/series/${seriesId}`);
}

export async function moveSeriesMessage(
  entryId: string,
  seriesId: string,
  direction: 'up' | 'down',
): Promise<void> {
  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  const { data: entries } = await supabase
    .from('series_messages')
    .select('id, position')
    .eq('series_id', seriesId)
    .eq('workspace_id', workspace.id)
    .order('position', { ascending: true });
  if (!entries) return;

  const index = entries.findIndex((e) => e.id === entryId);
  const neighborIndex = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || neighborIndex < 0 || neighborIndex >= entries.length) return;

  const current = entries[index]!;
  const neighbor = entries[neighborIndex]!;
  await supabase
    .from('series_messages')
    .update({ position: neighbor.position })
    .eq('id', current.id)
    .eq('workspace_id', workspace.id);
  await supabase
    .from('series_messages')
    .update({ position: current.position })
    .eq('id', neighbor.id)
    .eq('workspace_id', workspace.id);
  revalidatePath(`/series/${seriesId}`);
}
