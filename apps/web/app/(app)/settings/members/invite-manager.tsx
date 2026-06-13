'use client';

import { useActionState, useState, type KeyboardEvent } from 'react';
import { MEMBER_ROLE_LABELS } from '@/lib/labels';
import { createInvitation, revokeInvitation, type InviteState } from './actions';

type PendingInvite = { id: string; email: string; role: string; token: string };

const initial: InviteState = {};
const ROLES = ['pastor', 'planner', 'viewer'] as const;

function imeGuard(e: KeyboardEvent<HTMLInputElement>) {
  const n = e.nativeEvent as unknown as { isComposing?: boolean; keyCode?: number };
  if (e.key === 'Enter' && (n.isComposing || n.keyCode === 229)) e.preventDefault();
}

function inviteUrl(token: string): string {
  if (typeof window === 'undefined') return `/invite/${token}`;
  return `${window.location.origin}/invite/${token}`;
}

function CopyLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(inviteUrl(token));
          setCopied(true);
        } catch {
          setCopied(false);
        }
      }}
      className="rounded-md border border-line px-2 py-1 text-xs text-indigo-deep hover:bg-indigo-deep/5"
    >
      {copied ? 'コピーしました' : 'リンクをコピー'}
    </button>
  );
}

export function InviteManager({ pending }: { pending: PendingInvite[] }) {
  const [state, formAction, busy] = useActionState(createInvitation, initial);

  return (
    <section
      aria-label="メンバーの招待"
      className="rounded-lg border border-line bg-paper-raised p-4"
    >
      <h2 className="text-sm font-medium text-ink">メンバーを招待</h2>
      <p className="mt-1 text-xs text-ink-muted">
        メールアドレスとロールを指定して招待リンクを作成します。相手は招待されたメールでログインし、
        リンクを開いて参加します（メール自動送信は今後追加）。
      </p>
      <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs text-ink-muted">メールアドレス</span>
          <input
            type="email"
            name="email"
            required
            maxLength={200}
            onKeyDown={imeGuard}
            placeholder="例: planner@example.com"
            className="rounded-md border border-line bg-paper px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink-muted">ロール</span>
          <select
            name="role"
            defaultValue="planner"
            className="rounded-md border border-line bg-paper px-2 py-1.5 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {MEMBER_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-indigo-deep px-4 py-2 text-sm font-medium text-paper-raised hover:bg-indigo-soft disabled:opacity-50"
        >
          招待を作成
        </button>
        {state.error ? <p className="w-full text-xs text-red-800">{state.error}</p> : null}
        {state.ok && state.token ? (
          <p className="flex w-full flex-wrap items-center gap-2 text-xs text-ink-muted">
            招待リンクを作成しました:
            <code className="rounded bg-paper px-1 py-0.5 text-ink">{inviteUrl(state.token)}</code>
            <CopyLink token={state.token} />
          </p>
        ) : null}
      </form>

      {pending.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-3">
          {pending.map((inv) => (
            <li key={inv.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="text-ink">{inv.email}</span>
              <span className="rounded-full bg-indigo-deep/5 px-2 py-0.5 text-xs text-indigo-deep">
                {MEMBER_ROLE_LABELS[inv.role] ?? inv.role}
              </span>
              <span className="text-xs text-ink-muted">招待中</span>
              <span className="ml-auto flex items-center gap-2">
                <CopyLink token={inv.token} />
                <form action={revokeInvitation.bind(null, inv.id)}>
                  <button
                    type="submit"
                    className="rounded-md px-2 py-1 text-xs text-ink-muted hover:text-red-800"
                  >
                    取り消す
                  </button>
                </form>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
