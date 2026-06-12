import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { SERIES_STATUS_LABELS } from '@/lib/labels';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';
import { SeriesCreateForm } from './series-create-form';

export const metadata: Metadata = { title: 'シリーズ' };

export default async function SeriesPage() {
  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  const { data: seriesList, error } = await supabase
    .from('series')
    .select('id, name, description, status, starts_on, ends_on, color, series_messages(id)')
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  return (
    <>
      <PageHeader title="シリーズ" description="連続講解などの説教シリーズを計画します。" />
      <div className="flex flex-col gap-6">
        <SeriesCreateForm />
        {error ? (
          <div role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
            一覧を読み込めませんでした。再読み込みしてください。
          </div>
        ) : seriesList && seriesList.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {seriesList.map((s) => (
              <li key={s.id} className="rounded-lg border border-line bg-paper-raised px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  {s.color ? (
                    <span
                      aria-hidden
                      className="inline-block h-3 w-3 rounded-full border border-line"
                      style={{ backgroundColor: s.color }}
                    />
                  ) : null}
                  <Link
                    href={`/series/${s.id}`}
                    className="font-medium text-ink hover:text-indigo-deep hover:underline"
                  >
                    {s.name}
                  </Link>
                  <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-muted">
                    {SERIES_STATUS_LABELS[s.status] ?? s.status}
                  </span>
                  <span className="text-xs text-ink-muted">{s.series_messages.length} Message</span>
                </div>
                {s.description ? (
                  <p className="mt-1 line-clamp-1 text-sm text-ink-muted">{s.description}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="シリーズはまだありません"
            description="上のフォームからシリーズ名だけで作成できます。"
          />
        )}
      </div>
    </>
  );
}
