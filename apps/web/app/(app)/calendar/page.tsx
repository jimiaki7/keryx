import type { Metadata } from 'next';
import Link from 'next/link';
import {
  addMonths,
  formatMonthJa,
  gridRange,
  isValidYearMonth,
  monthGrid,
  tokyoDateOf,
  tokyoYearMonthOf,
} from '@keryx/domain';
import { GatheringCreateForm } from '@/components/gathering-create-form';
import { PageHeader } from '@/components/page-header';
import { GATHERING_KIND_LABELS, GATHERING_STATUS_LABELS } from '@/lib/labels';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';

export const metadata: Metadata = { title: 'カレンダー' };

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function tokyoTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function tokyoDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; date?: string }>;
}) {
  const { month: monthParam, date: dateParam } = await searchParams;
  const today = tokyoDateOf(new Date().toISOString());
  const currentMonth = tokyoYearMonthOf(new Date());
  const month = monthParam && isValidYearMonth(monthParam) ? monthParam : currentMonth;
  // 「＋」から渡された日付を作成フォームの初期値にする
  const defaultStartsAt =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? `${dateParam}T10:30` : undefined;

  const workspace = await getActiveWorkspace();
  const supabase = await createClient();

  const { start, end } = gridRange(month);
  const nowIso = new Date().toISOString();
  const [{ data: gatherings }, { data: upcoming }] = await Promise.all([
    supabase
      .from('gatherings')
      .select('id, title, kind, status, starts_at')
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .gte('starts_at', `${start}T00:00:00+09:00`)
      .lte('starts_at', `${end}T23:59:59.999+09:00`)
      .order('starts_at', { ascending: true }),
    supabase
      .from('gatherings')
      .select(
        'id, display_id, title, kind, status, starts_at, venues(name), message_deliveries(messages(title))',
      )
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .gte('starts_at', nowIso)
      .order('starts_at', { ascending: true })
      .limit(12),
  ]);

  const byDate = new Map<string, NonNullable<typeof gatherings>>();
  for (const g of gatherings ?? []) {
    const key = tokyoDateOf(g.starts_at);
    const list = byDate.get(key) ?? [];
    list.push(g);
    byDate.set(key, list);
  }

  const weeks = monthGrid(month);

  return (
    <>
      <PageHeader title="カレンダー" description="月間の礼拝予定の見渡しと作成を行います。" />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-medium text-indigo-deep">{formatMonthJa(month)}</h2>
        <nav aria-label="月の移動" className="flex gap-1">
          <Link
            href={`/calendar?month=${addMonths(month, -1)}`}
            className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-indigo-deep/5"
          >
            ← 前月
          </Link>
          <Link
            href="/calendar"
            className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-indigo-deep/5"
          >
            今月
          </Link>
          <Link
            href={`/calendar?month=${addMonths(month, 1)}`}
            className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-indigo-deep/5"
          >
            翌月 →
          </Link>
        </nav>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] table-fixed border-collapse">
          <thead>
            <tr>
              {WEEKDAYS.map((w, i) => (
                <th
                  key={w}
                  scope="col"
                  className={`border border-line bg-paper-raised px-2 py-1.5 text-xs font-medium ${
                    i === 0 ? 'text-red-800/70' : i === 6 ? 'text-indigo-soft' : 'text-ink-muted'
                  }`}
                >
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0]!.date}>
                {week.map((day) => {
                  const items = byDate.get(day.date) ?? [];
                  const isToday = day.date === today;
                  const dayNumber = Number(day.date.slice(8));
                  return (
                    <td
                      key={day.date}
                      className={`group h-24 border border-line p-1 align-top ${
                        day.inMonth ? 'bg-paper-raised' : 'bg-paper text-ink-muted'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                            isToday
                              ? 'bg-indigo-deep font-medium text-paper-raised'
                              : day.inMonth
                                ? 'text-ink'
                                : 'text-ink-muted'
                          }`}
                        >
                          {dayNumber}
                        </span>
                        <Link
                          href={`/calendar?month=${month}&date=${day.date}#new-gathering`}
                          aria-label={`${day.date} に礼拝予定を作成`}
                          className="rounded px-1.5 text-sm text-ink-muted opacity-0 hover:bg-indigo-deep/10 hover:text-indigo-deep focus:opacity-100 group-hover:opacity-100"
                        >
                          ＋
                        </Link>
                      </div>
                      <ul className="mt-0.5 flex flex-col gap-0.5">
                        {items.map((g) => (
                          <li key={g.id}>
                            <Link
                              href={`/gatherings/${g.id}`}
                              className={`block truncate rounded px-1 py-0.5 text-[11px] leading-tight hover:bg-indigo-deep/10 ${
                                g.status === 'canceled'
                                  ? 'text-ink-muted line-through'
                                  : 'bg-indigo-deep/5 text-indigo-deep'
                              }`}
                            >
                              {tokyoTime(g.starts_at)}{' '}
                              {g.title || GATHERING_KIND_LABELS[g.kind] || g.kind}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        日付の「＋」からその日の予定を作成できます。教会暦・祝日の表示は今後追加されます。
      </p>

      <section aria-label="礼拝予定を作成" id="new-gathering" className="mt-8 scroll-mt-4">
        <h2 className="mb-2 text-sm font-medium text-ink">礼拝予定を作成</h2>
        <GatheringCreateForm defaultStartsAt={defaultStartsAt} />
      </section>

      <section aria-label="今後の予定" className="mt-8">
        <h2 className="mb-2 text-sm font-medium text-ink">今後の予定</h2>
        {upcoming && upcoming.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {upcoming.map((g) => {
              const messageTitle = g.message_deliveries[0]?.messages?.title;
              return (
                <li
                  key={g.id}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-line bg-paper-raised px-4 py-2.5 text-sm"
                >
                  <time dateTime={g.starts_at} className="w-32 text-indigo-soft">
                    {tokyoDateTime(g.starts_at)}
                  </time>
                  <Link
                    href={`/gatherings/${g.id}`}
                    className="font-medium text-ink hover:text-indigo-deep hover:underline"
                  >
                    {g.title || GATHERING_KIND_LABELS[g.kind] || g.kind}
                  </Link>
                  <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-muted">
                    {GATHERING_STATUS_LABELS[g.status] ?? g.status}
                  </span>
                  {messageTitle ? (
                    <span className="text-ink-muted">{messageTitle}</span>
                  ) : (
                    <span className="text-xs text-gold">Message 未定</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-line bg-paper-raised px-4 py-6 text-center text-sm text-ink-muted">
            今後の予定はありません。上のフォームから作成できます。
          </p>
        )}
      </section>
    </>
  );
}
