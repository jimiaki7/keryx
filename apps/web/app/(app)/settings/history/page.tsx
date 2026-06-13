import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { AUDIT_ACTION_LABELS, ENTITY_TYPE_LABELS, FIELD_LABELS } from '@/lib/labels';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';
import { restoreGathering, restoreMessage, restoreSeries } from './actions';

export const metadata: Metadata = { title: '履歴と復元' };

function tokyoDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type RestoreItem = { id: string; label: string; sub: string };

function RestoreList({
  title,
  items,
  action,
}: {
  title: string;
  items: RestoreItem[];
  action: (id: string) => Promise<void>;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-ink-muted">{title}</h3>
      <ul className="flex flex-col gap-2">
        {items.map((it) => (
          <li
            key={it.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-paper-raised px-4 py-2"
          >
            <span className="font-medium text-ink">{it.label}</span>
            <span className="text-xs text-ink-muted">{it.sub}</span>
            <form action={action.bind(null, it.id)} className="ml-auto">
              <button
                type="submit"
                className="rounded-md border border-indigo-deep px-3 py-1 text-xs text-indigo-deep hover:bg-indigo-deep/5"
              >
                復元
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function HistoryPage() {
  const workspace = await getActiveWorkspace();
  const supabase = await createClient();

  const [{ data: messages }, { data: gatherings }, { data: series }, { data: events }] =
    await Promise.all([
      supabase
        .from('messages')
        .select('id, display_id, title, updated_at')
        .eq('workspace_id', workspace.id)
        .not('deleted_at', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(50),
      supabase
        .from('gatherings')
        .select('id, display_id, title, starts_at, updated_at')
        .eq('workspace_id', workspace.id)
        .not('deleted_at', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(50),
      supabase
        .from('series')
        .select('id, name, updated_at')
        .eq('workspace_id', workspace.id)
        .not('deleted_at', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(50),
      supabase
        .from('audit_events')
        .select('id, entity_type, action, summary, changed_fields, created_at')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(60),
    ]);

  const deletedMessages: RestoreItem[] = (messages ?? []).map((m) => ({
    id: m.id,
    label: m.title || '（無題）',
    sub: m.display_id,
  }));
  const deletedGatherings: RestoreItem[] = (gatherings ?? []).map((g) => ({
    id: g.id,
    label: g.title || '礼拝予定',
    sub: tokyoDateTime(g.starts_at),
  }));
  const deletedSeries: RestoreItem[] = (series ?? []).map((s) => ({
    id: s.id,
    label: s.name,
    sub: 'シリーズ',
  }));
  const hasDeleted = deletedMessages.length + deletedGatherings.length + deletedSeries.length > 0;

  return (
    <>
      <PageHeader
        title="履歴と復元"
        description="変更の履歴の確認と、削除した項目の復元を行います。"
      />
      <div className="flex flex-col gap-6">
        <Link href="/settings" className="text-sm text-ink-muted hover:text-ink">
          ← 設定
        </Link>

        <section aria-label="削除した項目の復元" className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-ink">削除した項目の復元</h2>
          {hasDeleted ? (
            <>
              <RestoreList title="メッセージ" items={deletedMessages} action={restoreMessage} />
              <RestoreList title="礼拝予定" items={deletedGatherings} action={restoreGathering} />
              <RestoreList title="シリーズ" items={deletedSeries} action={restoreSeries} />
            </>
          ) : (
            <p className="text-sm text-ink-muted">削除した項目はありません。</p>
          )}
        </section>

        <section aria-label="変更履歴" className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-ink">変更履歴</h2>
          {events && events.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {events.map((e) => {
                const fields = Array.isArray(e.changed_fields)
                  ? (e.changed_fields as string[])
                  : [];
                const fieldLabels = fields
                  .map((f) => FIELD_LABELS[f] ?? f)
                  .filter((f) => f !== '削除状態');
                return (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-line/60 py-1.5 text-sm"
                  >
                    <span className="rounded-full bg-indigo-deep/5 px-2 py-0.5 text-xs text-indigo-deep">
                      {ENTITY_TYPE_LABELS[e.entity_type] ?? e.entity_type}
                    </span>
                    <span className="text-ink-muted">
                      {AUDIT_ACTION_LABELS[e.action] ?? e.action}
                    </span>
                    <span className="text-ink">{e.summary || '（無題）'}</span>
                    {e.action === 'update' && fieldLabels.length > 0 ? (
                      <span className="text-xs text-ink-muted">（{fieldLabels.join('・')}）</span>
                    ) : null}
                    <time dateTime={e.created_at} className="ml-auto text-xs text-ink-muted">
                      {tokyoDateTime(e.created_at)}
                    </time>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              title="まだ履歴はありません"
              description="作成・更新・削除の操作がここに記録されます。"
            />
          )}
        </section>
      </div>
    </>
  );
}
