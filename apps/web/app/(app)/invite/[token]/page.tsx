import type { Metadata } from 'next';
import Link from 'next/link';
import { MEMBER_ROLE_LABELS } from '@/lib/labels';
import { createClient } from '@/lib/supabase/server';
import { AcceptInvitation } from './accept-invitation';

export const metadata: Metadata = { title: '招待' };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc('peek_invitation', { p_token: token });
  const info = data?.[0];

  let message: string | null = null;
  if (!info) message = '招待が見つかりません。リンクをご確認ください。';
  else if (info.status === 'revoked') message = 'この招待は取り消されています。';
  else if (info.status === 'accepted') message = 'この招待はすでに使用されています。';
  else if (info.expired) message = 'この招待は期限切れです。オーナーに再発行を依頼してください。';

  return (
    <div className="mx-auto max-w-md py-10">
      <div className="rounded-lg border border-line bg-paper-raised p-6">
        <h1 className="text-lg font-semibold text-indigo-deep">ワークスペースへの招待</h1>
        {message ? (
          <p className="mt-3 text-sm text-ink-muted">{message}</p>
        ) : (
          <>
            <p className="mt-3 text-sm text-ink">
              <span className="font-medium">{info!.workspace_name}</span> に
              <span className="mx-1 rounded-full bg-indigo-deep/5 px-2 py-0.5 text-xs text-indigo-deep">
                {MEMBER_ROLE_LABELS[info!.role] ?? info!.role}
              </span>
              として招待されています。
            </p>
            <p className="mt-2 text-xs text-ink-muted">
              招待されたメールアドレスでログインしている場合に参加できます。
            </p>
            <AcceptInvitation token={token} />
          </>
        )}
        <Link href="/" className="mt-4 inline-block text-sm text-ink-muted hover:text-ink">
          ← ホーム
        </Link>
      </div>
    </div>
  );
}
