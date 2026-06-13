'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';

const PLANNER_ROLES = ['owner', 'pastor', 'planner'];

export type AddVenueResult = { id: string; name: string } | { error: string };

// 会場リストを表示する画面を更新する
function revalidateVenueViews() {
  revalidatePath('/messages/[id]', 'page');
  revalidatePath('/gatherings/[id]', 'page');
  revalidatePath('/calendar');
}

/** 会場をリストに追加する（同名の active があればそれを返す＝重複作成しない） */
export async function addVenue(rawName: string): Promise<AddVenueResult> {
  const parsed = z.string().trim().min(1, '会場名を入力してください。').max(100).safeParse(rawName);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '会場名を入力してください。' };
  }
  const workspace = await getActiveWorkspace();
  if (!PLANNER_ROLES.includes(workspace.role)) return { error: '会場を追加する権限がありません。' };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('venues')
    .select('id, name')
    .eq('workspace_id', workspace.id)
    .eq('name', parsed.data)
    .is('deleted_at', null)
    .maybeSingle();
  if (existing) {
    revalidateVenueViews();
    return existing;
  }
  const { data, error } = await supabase
    .from('venues')
    .insert({ workspace_id: workspace.id, name: parsed.data })
    .select('id, name')
    .single();
  if (error || !data) return { error: '会場を追加できませんでした。もう一度お試しください。' };
  revalidateVenueViews();
  return data;
}

/** 会場をリストから削除する（ソフトデリート。既存の礼拝予定の表示名には影響しない） */
export async function deleteVenue(id: string): Promise<void> {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return;
  const workspace = await getActiveWorkspace();
  if (!PLANNER_ROLES.includes(workspace.role)) return;
  const supabase = await createClient();
  await supabase
    .from('venues')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', parsed.data)
    .eq('workspace_id', workspace.id);
  revalidateVenueViews();
}
