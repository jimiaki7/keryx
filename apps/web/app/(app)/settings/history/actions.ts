'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';

/** ソフトデリート済みエンティティを復元する（deleted_at を null に戻す）。
 *  書き込みロールは各テーブルの RLS が強制する（messages/series=owner/pastor、gatherings=planner+）。
 *  audit_events には trigger が action='restore' を記録する。 */
async function restore(table: 'messages' | 'gatherings' | 'series', id: string): Promise<void> {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return;
  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  await supabase
    .from(table)
    .update({ deleted_at: null })
    .eq('id', parsed.data)
    .eq('workspace_id', workspace.id)
    .not('deleted_at', 'is', null);
  revalidatePath('/settings/history');
}

export async function restoreMessage(id: string): Promise<void> {
  await restore('messages', id);
  revalidatePath('/messages');
  revalidatePath('/');
}

export async function restoreGathering(id: string): Promise<void> {
  await restore('gatherings', id);
  revalidatePath('/calendar');
  revalidatePath('/');
}

export async function restoreSeries(id: string): Promise<void> {
  await restore('series', id);
  revalidatePath('/messages/series');
}
