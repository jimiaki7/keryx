import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { GATHERING_KIND_LABELS, GATHERING_STATUS_LABELS } from '@/lib/labels';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';
import { GatheringCreateForm } from './gathering-create-form';

export const metadata: Metadata = { title: '礼拝予定' };

function formatTokyo(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function GatheringsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  // カレンダーの「＋」から渡された日付（YYYY-MM-DD）を作成フォームの初期値にする
  const defaultStartsAt = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T10:30` : undefined;
  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  const { data: gatherings, error } = await supabase
    .from('gatherings')
    .select(
      'id, display_id, title, kind, status, starts_at, venues(name), message_deliveries(messages(title))',
    )
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .order('starts_at', { ascending: true });

  return (
    <>
      <PageHeader
        title="礼拝予定"
        description="礼拝・集会の日時と礼拝順序を計画します。月間カレンダーは今後追加されます。"
      />
      <div className="flex flex-col gap-6">
        <GatheringCreateForm defaultStartsAt={defaultStartsAt} />
        {error ? (
          <div role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
            一覧を読み込めませんでした。再読み込みしてください。
          </div>
        ) : gatherings && gatherings.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {gatherings.map((g) => {
              const messageTitle = g.message_deliveries[0]?.messages?.title;
              return (
                <li key={g.id} className="rounded-lg border border-line bg-paper-raised px-4 py-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <Link
                      href={`/gatherings/${g.id}`}
                      className="font-medium text-ink hover:text-indigo-deep hover:underline"
                    >
                      {g.title || GATHERING_KIND_LABELS[g.kind] || g.kind}
                    </Link>
                    <time dateTime={g.starts_at} className="text-sm text-indigo-soft">
                      {formatTokyo(g.starts_at)}
                    </time>
                    <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-muted">
                      {GATHERING_STATUS_LABELS[g.status] ?? g.status}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                    <span>{g.display_id}</span>
                    <span>{GATHERING_KIND_LABELS[g.kind] ?? g.kind}</span>
                    {g.venues?.name ? <span>{g.venues.name}</span> : null}
                    {messageTitle ? <span>説教: {messageTitle}</span> : <span>Message 未定</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title="礼拝予定はまだありません"
            description="上のフォームから日時だけで作成できます。Message や礼拝順序は後から計画できます。"
          />
        )}
      </div>
    </>
  );
}
