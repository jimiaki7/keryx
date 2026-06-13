'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';

const ROLES = ['owner', 'pastor', 'planner', 'viewer'] as const;

export type InviteState = { ok?: boolean; error?: string; token?: string; nonce?: number };

const inviteSchema = z.object({
  email: z.string().trim().email('正しいメールアドレスを入力してください。').max(200),
  role: z.enum(['pastor', 'planner', 'viewer']),
});

/** 招待を作成する（owner のみ）。共有用トークンを返す。RLS も owner を強制 */
export async function createInvitation(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const parsed = inviteSchema.safeParse({
    email: formData.get('email') ?? '',
    role: formData.get('role') ?? 'viewer',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '入力内容をご確認ください。' };
  }
  const workspace = await getActiveWorkspace();
  if (workspace.role !== 'owner') return { error: '招待できるのはオーナーのみです。' };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('invitations')
    .insert({ workspace_id: workspace.id, email: parsed.data.email, role: parsed.data.role })
    .select('token')
    .single();
  if (error || !data) return { error: '招待を作成できませんでした。もう一度お試しください。' };
  revalidatePath('/settings/members');
  return { ok: true, token: data.token, nonce: Date.now() };
}

/** 招待を取り消す（owner のみ） */
export async function revokeInvitation(id: string): Promise<void> {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return;
  const workspace = await getActiveWorkspace();
  if (workspace.role !== 'owner') return;
  const supabase = await createClient();
  await supabase
    .from('invitations')
    .update({ status: 'revoked' })
    .eq('id', parsed.data)
    .eq('workspace_id', workspace.id);
  revalidatePath('/settings/members');
}

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
