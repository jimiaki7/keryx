import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { MEMBER_ROLE_LABELS, MEMBER_STATUS_LABELS } from '@/lib/labels';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';
import { removeMember, updateMemberRole } from './actions';

export const metadata: Metadata = { title: 'メンバー' };

const ROLE_ORDER: Record<string, number> = { owner: 0, pastor: 1, planner: 2, viewer: 3 };
const ROLES = ['owner', 'pastor', 'planner', 'viewer'] as const;

export default async function MembersPage() {
  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rows } = await supabase
    .from('workspace_members')
    .select('id, user_id, role, status')
    .eq('workspace_id', workspace.id)
    .neq('status', 'removed');

  // profiles は workspace_members と直接の FK がないため別取得して突き合わせる
  // （profiles の RLS が同 workspace メンバーの display_name 閲覧を許可する）
  const userIds = (rows ?? []).map((r) => r.user_id);
  const { data: profs } =
    userIds.length > 0
      ? await supabase.from('profiles').select('id, display_name').in('id', userIds)
      : { data: [] };
  const nameById = new Map((profs ?? []).map((p) => [p.id, p.display_name]));

  const members = (rows ?? [])
    .slice()
    .sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9));
  const isOwner = workspace.role === 'owner';

  return (
    <>
      <PageHeader title="メンバー" description="Workspace のメンバーと権限を管理します。" />
      <div className="flex flex-col gap-6">
        <Link href="/settings" className="text-sm text-ink-muted hover:text-ink">
          ← 設定
        </Link>

        <section aria-label="メンバー一覧" className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-ink">メンバー</h2>
          <ul className="flex flex-col gap-2">
            {members.map((m) => {
              const self = m.user_id === user?.id;
              const name = nameById.get(m.user_id)?.trim();
              return (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line bg-paper-raised px-4 py-3"
                >
                  <span className="font-medium text-ink">{name || '（名前未設定）'}</span>
                  {self ? <span className="text-xs text-ink-muted">あなた</span> : null}
                  {m.status !== 'active' ? (
                    <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-muted">
                      {MEMBER_STATUS_LABELS[m.status] ?? m.status}
                    </span>
                  ) : null}

                  {isOwner && !self ? (
                    <div className="ml-auto flex items-center gap-2">
                      <form
                        action={updateMemberRole.bind(null, m.id)}
                        className="flex items-center gap-1"
                      >
                        <label className="sr-only" htmlFor={`role-${m.id}`}>
                          ロール
                        </label>
                        <select
                          id={`role-${m.id}`}
                          name="role"
                          defaultValue={m.role}
                          className="rounded-md border border-line bg-paper px-2 py-1 text-sm"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {MEMBER_ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="rounded-md border border-line px-2 py-1 text-xs text-indigo-deep hover:bg-indigo-deep/5"
                        >
                          変更
                        </button>
                      </form>
                      <form action={removeMember.bind(null, m.id)}>
                        <button
                          type="submit"
                          className="rounded-md px-2 py-1 text-xs text-ink-muted hover:text-red-800"
                        >
                          外す
                        </button>
                      </form>
                    </div>
                  ) : (
                    <span className="ml-auto rounded-full bg-indigo-deep/5 px-2 py-0.5 text-xs text-indigo-deep">
                      {MEMBER_ROLE_LABELS[m.role] ?? m.role}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section
          aria-label="ロールの説明"
          className="rounded-lg border border-line bg-paper-raised p-4 text-sm text-ink-muted"
        >
          <h2 className="text-sm font-medium text-ink">ロール</h2>
          <ul className="mt-2 flex flex-col gap-1">
            <li>
              <span className="text-ink">オーナー</span>: Workspace
              とメンバー・権限を管理。すべてを編集できます。
            </li>
            <li>
              <span className="text-ink">牧師</span>: メッセージ（説教内容）を含めて編集できます。
            </li>
            <li>
              <span className="text-ink">計画担当</span>:
              礼拝予定・礼拝順序・会場を管理できます（説教内容の編集は不可）。
            </li>
            <li>
              <span className="text-ink">閲覧</span>: 閲覧のみ。
            </li>
          </ul>
        </section>

        <section
          aria-label="メンバーの招待"
          className="rounded-lg border border-dashed border-line bg-paper-raised p-4 text-sm text-ink-muted"
        >
          <h2 className="text-sm font-medium text-ink">メンバーの招待</h2>
          <p className="mt-1">
            メールでの招待は次の段階で追加します。現在は、すでに参加しているメンバーのロール変更・
            削除ができます。
          </p>
        </section>
      </div>
    </>
  );
}
