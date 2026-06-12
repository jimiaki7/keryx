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
import { PageHeader } from '@/components/page-header';
import { GATHERING_KIND_LABELS } from '@/lib/labels';
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

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const today = tokyoDateOf(new Date().toISOString());
  const currentMonth = tokyoYearMonthOf(new Date());
  const month = monthParam && isValidYearMonth(monthParam) ? monthParam : currentMonth;

  const workspace = await getActiveWorkspace();
  const supabase = await createClient();

  const { start, end } = gridRange(month);
  const { data: gatherings } = await supabase
    .from('gatherings')
    .select('id, title, kind, status, starts_at')
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .gte('starts_at', `${start}T00:00:00+09:00`)
    .lte('starts_at', `${end}T23:59:59.999+09:00`)
    .order('starts_at', { ascending: true });

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
      <PageHeader title="カレンダー" description="月間の礼拝予定を見渡します。" />
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
        <Link
          href="/gatherings"
          className="ml-auto text-sm text-ink-muted hover:text-indigo-deep hover:underline"
        >
          リスト表示へ
        </Link>
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
                          href={`/gatherings?date=${day.date}`}
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
        日付の「＋」から、その日の礼拝予定を作成できます。教会暦・祝日の表示は今後追加されます。
      </p>
    </>
  );
}
