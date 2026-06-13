import type { Metadata } from 'next';
import Link from 'next/link';
import { BarList } from '@/components/analytics-bars';
import { EmptyState } from '@/components/empty-state';
import { MessagesTabs } from '@/components/messages-tabs';
import { PageHeader } from '@/components/page-header';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';

export const metadata: Metadata = { title: '分析' };

type Analytics = {
  totals: {
    messages: number;
    deliveries: number;
    messages_with_passage: number;
    messages_with_theme: number;
  };
  testament: { key: string; messages: number }[];
  genre: { genre: string; messages: number }[];
  books: { book_id: string; name: string; messages: number }[];
  themes: { theme: string; messages: number }[];
};

const EMPTY: Analytics = {
  totals: { messages: 0, deliveries: 0, messages_with_passage: 0, messages_with_theme: 0 },
  testament: [],
  genre: [],
  books: [],
  themes: [],
};

const TESTAMENT_LABELS: Record<string, string> = { old: '旧約', new: '新約' };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function cleanDate(v: string | string[] | undefined): string | undefined {
  const s = (Array.isArray(v) ? v[0] : v)?.trim() ?? '';
  return DATE_RE.test(s) ? s : undefined;
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-paper-raised p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="text-sm font-medium text-ink">{title}</h2>
        <span className="text-xs text-ink-muted">{note}</span>
      </div>
      {children}
    </section>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const from = cleanDate(raw.from);
  const to = cleanDate(raw.to);

  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('message_analytics', {
    p_workspace: workspace.id,
    ...(from ? { p_from: from } : {}),
    ...(to ? { p_to: to } : {}),
  });

  const a = (data as unknown as Analytics | null) ?? EMPTY;
  const hasPeriod = !!(from || to);
  const periodLabel = hasPeriod ? `${from ?? '最初'} 〜 ${to ?? '最新'}` : '全期間';
  const passageBase = `Message 単位・母数 ${a.totals.messages_with_passage}`;

  return (
    <>
      <PageHeader
        title="メッセージ"
        description="説教・祈祷会奨励と、その連続講解シリーズをここで管理します。"
      />
      <div className="flex flex-col gap-5">
        <MessagesTabs active="analytics" />

        <form
          method="get"
          action="/messages/analytics"
          className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-paper-raised p-4"
        >
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-muted">実施日（から）</span>
            <input
              type="date"
              name="from"
              defaultValue={from ?? ''}
              className="rounded-md border border-line bg-paper px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-muted">実施日（まで）</span>
            <input
              type="date"
              name="to"
              defaultValue={to ?? ''}
              className="rounded-md border border-line bg-paper px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-indigo-deep px-4 py-2 text-sm font-medium text-paper-raised hover:bg-indigo-soft"
          >
            適用
          </button>
          {hasPeriod ? (
            <Link
              href="/messages/analytics"
              className="rounded-md border border-line px-3 py-2 text-sm text-ink-muted hover:bg-indigo-deep/5"
            >
              全期間に戻す
            </Link>
          ) : null}
          <p className="w-full text-xs text-ink-muted">
            期間を指定すると、その期間に語った（実施した）メッセージだけを集計します。
          </p>
        </form>

        {error ? (
          <div role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
            分析を読み込めませんでした。再読み込みしてください。
          </div>
        ) : a.totals.messages === 0 ? (
          <EmptyState
            title="集計対象のメッセージがありません"
            description="メッセージを登録するか、期間条件を広げてください。"
          />
        ) : (
          <>
            <section className="rounded-lg border border-line bg-paper-raised p-4">
              <h2 className="text-sm font-medium text-ink">概要（対象期間: {periodLabel}）</h2>
              <dl className="mt-3 grid grid-cols-3 gap-x-6 text-sm">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-ink-muted">メッセージ数</dt>
                  <dd className="text-lg font-medium text-ink">{a.totals.messages}</dd>
                  <dd className="text-xs text-ink-muted">説教内容（Message 単位）</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-ink-muted">実施回数</dt>
                  <dd className="text-lg font-medium text-ink">{a.totals.deliveries}</dd>
                  <dd className="text-xs text-ink-muted">語った回数（Delivery 単位）</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-ink-muted">聖書箇所あり</dt>
                  <dd className="text-lg font-medium text-ink">{a.totals.messages_with_passage}</dd>
                  <dd className="text-xs text-ink-muted">箇所分析の母数</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-ink-muted">
                同じメッセージを複数回語った場合、内容の分析はメッセージ単位、実施回数は Delivery
                単位で数えます。下の箇所・ジャンル・主題はすべてメッセージ単位です。1
                つのメッセージが複数の箇所・ジャンルに計上されることがあり、合計が母数を上回る場合があります。
              </p>
            </section>

            {a.totals.messages_with_passage > 0 ? (
              <>
                <Section title="旧約 / 新約" note={passageBase}>
                  <BarList
                    items={a.testament.map((t) => ({
                      label: TESTAMENT_LABELS[t.key] ?? t.key,
                      value: t.messages,
                    }))}
                  />
                </Section>

                <Section title="書巻ジャンル" note={passageBase}>
                  <BarList items={a.genre.map((g) => ({ label: g.genre, value: g.messages }))} />
                </Section>

                <Section title="書巻別" note={passageBase}>
                  <BarList items={a.books.map((b) => ({ label: b.name, value: b.messages }))} />
                </Section>
              </>
            ) : (
              <section className="rounded-lg border border-line bg-paper-raised p-4 text-sm text-ink-muted">
                この期間に聖書箇所を登録したメッセージはありません。メッセージ詳細で聖書箇所を追加すると、旧約/新約・ジャンル・書巻の分析が表示されます。
              </section>
            )}

            {a.themes.length > 0 ? (
              <Section title="主題" note={`Message 単位・母数 ${a.totals.messages_with_theme}`}>
                <BarList items={a.themes.map((t) => ({ label: t.theme, value: t.messages }))} />
              </Section>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
