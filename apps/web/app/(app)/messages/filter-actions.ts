'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { parseSearchParams, SEARCH_KEYS } from '@/lib/message-search';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';

export type SaveFilterState = { ok?: boolean; nonce?: number; error?: string };

const nameSchema = z.string().trim().min(1, 'フィルター名を入力してください。').max(60);

/** 現在の検索条件に名前を付けて保存する（本人・workspace 内、同名は上書き） */
export async function saveFilter(
  _prev: SaveFilterState,
  formData: FormData,
): Promise<SaveFilterState> {
  const parsedName = nameSchema.safeParse(formData.get('name'));
  if (!parsedName.success) {
    return { error: parsedName.error.issues[0]?.message ?? '入力内容をご確認ください。' };
  }

  // フォームに載った現在の検索条件だけを正規化して保存する
  const raw: Record<string, string> = {};
  for (const k of SEARCH_KEYS) {
    const v = formData.get(k);
    if (typeof v === 'string') raw[k] = v;
  }
  const params = parseSearchParams(raw);

  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'ログインが必要です。' };

  const { error } = await supabase
    .from('saved_filters')
    .upsert(
      { workspace_id: workspace.id, user_id: user.id, name: parsedName.data, params },
      { onConflict: 'workspace_id,user_id,name' },
    );
  if (error) {
    return { error: 'フィルターを保存できませんでした。もう一度お試しください。' };
  }
  revalidatePath('/messages');
  return { ok: true, nonce: Date.now() };
}

export async function deleteSavedFilter(id: string): Promise<void> {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return;
  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  await supabase
    .from('saved_filters')
    .delete()
    .eq('id', parsed.data)
    .eq('workspace_id', workspace.id);
  revalidatePath('/messages');
}
