'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type AcceptState = { error?: string };

/** 招待を受ける。成功でホームへ、失敗は理由を返す（RPC が email 一致・期限などを検証）。
 *  useActionState から (prevState, formData) で呼ばれるが、token のみ使う（余分な引数は無視）。 */
export async function acceptInvitation(token: string): Promise<AcceptState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('accept_invitation', { p_token: token });
  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('different email')) {
      return {
        error: 'この招待は別のメールアドレス宛です。招待されたメールでログインしてください。',
      };
    }
    if (msg.includes('expired')) return { error: 'この招待は期限切れです。' };
    if (msg.includes('no longer valid'))
      return { error: 'この招待は無効です（取り消し済みなど）。' };
    if (msg.includes('already a member')) {
      return { error: 'すでにこのワークスペースのメンバーです。' };
    }
    return { error: '招待を受けられませんでした。' };
  }
  revalidatePath('/', 'layout');
  redirect('/');
}
