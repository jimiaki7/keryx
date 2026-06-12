import Link from 'next/link';
import { preparationStagePercent } from '@keryx/domain';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { GATHERING_KIND_LABELS, PREPARATION_STAGE_LABELS } from '@/lib/labels';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';
import { createDraftMessage } from './messages/actions';

function formatTokyo(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function daysUntil(iso: string): number {
  const tokyoDay = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' });
  const target = tokyoDay.format(new Date(iso));
  const today = tokyoDay.format(new Date());
  return Math.round((Date.parse(target) - Date.parse(today)) / 86400000);
}

export default async function HomePage() {
  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const fourWeeksIso = new Date(now.getTime() + 28 * 86400000).toISOString();

  const { data: upcoming } = await supabase
    .from('gatherings')
    .select(
      'id, title, kind, starts_at, venues(name), message_deliveries(speaker_name, messages(id, title, preparation_stage, message_passages(display_text, role)))',
    )
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .neq('status', 'canceled')
    .gte('starts_at', nowIso)
    .order('starts_at', { ascending: true })
    .limit(20);

  const next = upcoming?.[0];
  const nextMessage = next?.message_deliveries[0]?.messages ?? null;
  const nextPassage =
    nextMessage?.message_passages.find((p) => p.role === 'primary') ??
    nextMessage?.message_passages[0];

  const withinFourWeeks = (upcoming ?? []).filter((g) => g.starts_at <= fourWeeksIso);

  return (
    <>
      <PageHeader title="ホーム" description="次の礼拝と説教準備の状況を、ここで見渡せます。" />
      <div className="flex flex-col gap-6">
        <section aria-label="次の集会">
          {next ? (
            <div className="rounded-lg border border-line bg-paper-raised p-5">
              <p className="text-xs tracking-wide text-gold">次の集会</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Link
                  href={`/gatherings/${next.id}`}
                  className="text-xl font-semibold text-indigo-deep hover:underline"
                >
                  {next.title || GATHERING_KIND_LABELS[next.kind] || next.kind}
                </Link>
                <time dateTime={next.starts_at} className="text-sm text-ink">
                  {formatTokyo(next.starts_at)}
                </time>
                <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-muted">
                  {daysUntil(next.starts_at) === 0 ? '今日' : `あと${daysUntil(next.starts_at)}日`}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                {nextMessage ? (
                  <>
                    <Link
                      href={`/messages/${nextMessage.id}`}
                      className="font-medium text-ink hover:text-indigo-deep hover:underline"
                    >
                      {nextMessage.title || '（無題）'}
                    </Link>
                    {nextPassage ? (
                      <span className="text-indigo-soft">{nextPassage.display_text}</span>
                    ) : (
                      <span className="text-xs text-gold">聖書箇所が未入力です</span>
                    )}
                  </>
                ) : (
                  <span className="text-gold">メッセージ未定です</span>
                )}
                {next.venues?.name ? (
                  <span className="text-xs text-ink-muted">{next.venues.name}</span>
                ) : null}
                {next.message_deliveries[0]?.speaker_name ? (
                  <span className="text-xs text-ink-muted">
                    説教者: {next.message_deliveries[0].speaker_name}
                  </span>
                ) : null}
              </div>
              {nextMessage ? (
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-xs text-ink-muted">
                    準備:{' '}
                    {PREPARATION_STAGE_LABELS[nextMessage.preparation_stage] ??
                      nextMessage.preparation_stage}
                  </span>
                  <div
                    role="progressbar"
                    aria-valuenow={preparationStagePercent(nextMessage.preparation_stage)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="準備段階"
                    className="h-1.5 w-40 overflow-hidden rounded-full bg-line"
                  >
                    <div
                      className="h-full rounded-full bg-indigo-deep"
                      style={{
                        width: `${preparationStagePercent(nextMessage.preparation_stage)}%`,
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState
              title="次の礼拝予定はまだありません"
              description="右下の「＋」からメッセージを追加し、詳細ページで礼拝予定を割り当てると、次の主日・聖書箇所・準備の進み具合がここに表示されます。"
            />
          )}
        </section>

        <section aria-label="今後4週間の予定">
          <h2 className="mb-2 text-sm font-medium text-ink">今後4週間</h2>
          {withinFourWeeks.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {withinFourWeeks.map((g) => {
                const m = g.message_deliveries[0]?.messages;
                return (
                  <li
                    key={g.id}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-line bg-paper-raised px-4 py-2.5 text-sm"
                  >
                    <time dateTime={g.starts_at} className="w-32 text-indigo-soft">
                      {formatTokyo(g.starts_at)}
                    </time>
                    <Link
                      href={`/gatherings/${g.id}`}
                      className="font-medium text-ink hover:text-indigo-deep hover:underline"
                    >
                      {g.title || GATHERING_KIND_LABELS[g.kind] || g.kind}
                    </Link>
                    {m ? (
                      <span className="text-ink-muted">{m.title || '（無題）'}</span>
                    ) : (
                      <span className="text-xs text-gold">メッセージ未定</span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-line bg-paper-raised px-4 py-6 text-center text-sm text-ink-muted">
              今後4週間の予定はありません。
            </p>
          )}
        </section>
      </div>

      <form action={createDraftMessage}>
        <button
          type="submit"
          aria-label="メッセージを追加"
          title="メッセージを追加"
          className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-deep text-3xl font-light text-paper-raised shadow-lg transition-colors hover:bg-indigo-soft md:bottom-8 md:right-8"
        >
          ＋
        </button>
      </form>
    </>
  );
}
