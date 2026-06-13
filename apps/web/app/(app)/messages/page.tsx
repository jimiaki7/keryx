import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { createDraftMessage } from './actions';
import { MessageList, type MessageListItem } from '@/components/message-list';
import { MessageSearchForm } from '@/components/message-search-form';
import { MessagesTabs } from '@/components/messages-tabs';
import { PageHeader } from '@/components/page-header';
import { SavedFilters } from '@/components/saved-filters';
import {
  hasAnyFilter,
  PAGE_SIZE,
  parsePage,
  parseSearchParams,
  toQueryString,
  toRpcArgs,
  type MessageSearchParams,
} from '@/lib/message-search';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';

export const metadata: Metadata = { title: 'メッセージ' };

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = parseSearchParams(raw);
  const hasFilter = hasAnyFilter(params);
  const page = parsePage(raw);
  const offset = (page - 1) * PAGE_SIZE;

  const workspace = await getActiveWorkspace();
  const supabase = await createClient();

  const [{ data: messages, error }, { data: seriesList }, { data: saved }] = await Promise.all([
    supabase.rpc('search_messages', {
      p_workspace: workspace.id,
      ...toRpcArgs(params),
      p_limit: PAGE_SIZE,
      p_offset: offset,
    }),
    supabase
      .from('series')
      .select('id, name')
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .order('name', { ascending: true }),
    supabase
      .from('saved_filters')
      .select('id, name, params')
      .eq('workspace_id', workspace.id)
      .order('name', { ascending: true }),
  ]);

  const rows = messages ?? [];
  const items: MessageListItem[] = rows.map((r) => ({
    id: r.id,
    display_id: r.display_id,
    type: r.type,
    status: r.status,
    preparation_stage: r.preparation_stage,
    title: r.title,
    created_at: r.created_at,
    passages: (r.passages ?? []) as { display_text: string; role: string }[],
  }));
  const total = Number(rows[0]?.total_count ?? 0);
  const baseQuery = toQueryString(params);
  const pageHref = (p: number) => `/messages?${baseQuery ? `${baseQuery}&` : ''}page=${p}`;
  const hasPrev = page > 1;
  const hasNext = offset + items.length < total;

  return (
    <>
      <PageHeader
        title="メッセージ"
        description="説教・祈祷会奨励と、その連続講解シリーズをここで管理します。"
      />
      <div className="flex flex-col gap-5">
        <MessagesTabs active="list" />
        <form action={createDraftMessage}>
          <button
            type="submit"
            className="rounded-md bg-indigo-deep px-4 py-2 text-sm font-medium text-paper-raised hover:bg-indigo-soft"
          >
            ＋ 新規作成
          </button>
        </form>

        <MessageSearchForm params={params} series={seriesList ?? []} hasFilter={hasFilter} />
        <SavedFilters
          saved={(saved ?? []) as { id: string; name: string; params: MessageSearchParams }[]}
          current={params}
          hasFilter={hasFilter}
        />

        {/* 件数は 0 件でも常設のライブリージョンで通知する（GET 遷移後の読み上げ・WCAG 4.1.3） */}
        {hasFilter ? (
          <p role="status" aria-live="polite" className="text-sm text-ink-muted">
            {total} 件が一致しました。
          </p>
        ) : null}

        {error ? (
          <div role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
            一覧を読み込めませんでした。再読み込みしてください。
          </div>
        ) : items.length > 0 ? (
          <>
            <MessageList messages={items} />
            {hasPrev || hasNext ? (
              <nav
                aria-label="ページ送り"
                className="flex items-center justify-between gap-2 text-sm"
              >
                {hasPrev ? (
                  <Link
                    href={pageHref(page - 1)}
                    rel="prev"
                    className="rounded-md border border-line px-3 py-1.5 text-ink-muted hover:bg-indigo-deep/5"
                  >
                    ← 前へ
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-ink-muted">
                  {offset + 1}–{offset + items.length} / {total}
                </span>
                {hasNext ? (
                  <Link
                    href={pageHref(page + 1)}
                    rel="next"
                    className="rounded-md border border-line px-3 py-1.5 text-ink-muted hover:bg-indigo-deep/5"
                  >
                    次へ →
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </>
        ) : (
          <EmptyState
            title={
              hasFilter ? '条件に一致するメッセージはありません' : 'メッセージはまだありません'
            }
            description={
              hasFilter
                ? '条件を変えるか「クリア」で全件に戻せます。'
                : '「新規作成」から詳細ページで入力できます。ホームの Quick Add も使えます。'
            }
          />
        )}
      </div>
    </>
  );
}
