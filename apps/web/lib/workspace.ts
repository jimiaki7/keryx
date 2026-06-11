import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type ActiveWorkspace = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

/**
 * ログインユーザーの active workspace を返す。無ければ個人 Workspace を作成する。
 * 注意: Next.js は同一リクエスト内の同一 GET fetch をメモ化するため、
 * 作成後に同じクエリを再実行せず、RPC（冪等）の戻り値の workspace id を直接使う。
 */
export const getActiveWorkspace = cache(async (): Promise<ActiveWorkspace> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  let workspaceId: string;
  let role: string;

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membership) {
    workspaceId = membership.workspace_id;
    role = membership.role;
  } else {
    // 初回ログイン: 個人 Workspace を作成（RPC は冪等。並行実行でも同じ workspace が返る）
    const slug = `ws-${user.id.replaceAll('-', '').slice(0, 12)}`;
    const { data: createdId, error: rpcError } = await supabase.rpc('create_workspace', {
      workspace_name: 'マイワークスペース',
      workspace_slug: slug,
    });
    if (rpcError || !createdId) {
      throw new Error(`workspace の初期化に失敗しました: ${rpcError?.message ?? 'no id'}`);
    }
    workspaceId = createdId;
    role = 'owner';
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id, name, slug')
    .eq('id', workspaceId)
    .single();
  if (!workspace) {
    throw new Error(`workspace を取得できませんでした: ${workspaceError?.message ?? 'no row'}`);
  }

  return { id: workspace.id, name: workspace.name, slug: workspace.slug, role };
});
