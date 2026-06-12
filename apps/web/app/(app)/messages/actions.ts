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
