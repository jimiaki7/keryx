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
  // getClaims() は ES256 JWT をローカル検証する（認証サーバーへの往復なし）。
  // ミドルウェアが先にセッションを検証・更新済みのため、ここでは user id の取得に使う。
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect('/login');

  // メンバーシップと workspace を1クエリ（埋め込み結合）で取得し、往復を1回に減らす。
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role, workspaces(id, name, slug)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membership?.workspaces) {
    const ws = membership.workspaces;
    return { id: ws.id, name: ws.name, slug: ws.slug, role: membership.role };
  }

  // 初回ログイン: 個人 Workspace を作成（RPC は冪等。並行実行でも同じ workspace が返る）。
  // 既存 workspace を返す稀なケースに備え、名前・slug は作成後に取得する。
  const slug = `ws-${userId.replaceAll('-', '').slice(0, 12)}`;
  const { data: createdId, error: rpcError } = await supabase.rpc('create_workspace', {
    workspace_name: 'マイワークスペース',
    workspace_slug: slug,
  });
  if (rpcError || !createdId) {
    throw new Error(`workspace の初期化に失敗しました: ${rpcError?.message ?? 'no id'}`);
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id, name, slug')
    .eq('id', createdId)
    .single();
  if (!workspace) {
    throw new Error(`workspace を取得できませんでした: ${workspaceError?.message ?? 'no row'}`);
  }

  return { id: workspace.id, name: workspace.name, slug: workspace.slug, role: 'owner' };
});
