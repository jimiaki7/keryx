'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';

const ROLES = ['owner', 'pastor', 'planner', 'viewer'] as const;

/** メンバーのロールを変更する（owner のみ。自分自身は変更不可＝ロックアウト防止）。RLS も owner を強制 */
export async function updateMemberRole(memberId: string, formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(memberId);
  const role = z.enum(ROLES).safeParse(formData.get('role'));
  if (!id.success || !role.success) return;
  const workspace = await getActiveWorkspace();
  if (workspace.role !== 'owner') return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('workspace_members')
    .update({ role: role.data })
    .eq('id', id.data)
    .eq('workspace_id', workspace.id)
    .neq('user_id', user.id); // 自分のロールは変えない
  revalidatePath('/settings/members');
}

/** メンバーを外す（status=removed。is_active_member が false になり即アクセス不能）。owner のみ・自分以外 */
export async function removeMember(memberId: string): Promise<void> {
  const id = z.uuid().safeParse(memberId);
  if (!id.success) return;
  const workspace = await getActiveWorkspace();
  if (workspace.role !== 'owner') return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('workspace_members')
    .update({ status: 'removed' })
    .eq('id', id.data)
    .eq('workspace_id', workspace.id)
    .neq('user_id', user.id);
  revalidatePath('/settings/members');
}
