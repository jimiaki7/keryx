'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import {
  deleteSavedFilter,
  saveFilter,
  type SaveFilterState,
} from '@/app/(app)/messages/filter-actions';
import { SEARCH_KEYS, toQueryString, type MessageSearchParams } from '@/lib/message-search';

type SavedFilter = { id: string; name: string; params: MessageSearchParams };

const initial: SaveFilterState = {};

export function SavedFilters({
  saved,
  current,
  hasFilter,
}: {
  saved: SavedFilter[];
  current: MessageSearchParams;
  hasFilter: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveFilter, initial);

  if (saved.length === 0 && !hasFilter) return null;

  return (
    <div className="flex flex-col gap-2">
      {saved.length > 0 ? (
        <ul className="flex flex-wrap items-center gap-2">
          <li className="text-xs text-ink-muted">保存した条件:</li>
          {saved.map((f) => {
            const qs = toQueryString(f.params);
            return (
              <li
                key={f.id}
                className="flex items-center gap-1 rounded-full border border-line bg-paper-raised pl-3 text-sm"
              >
                <Link
                  href={qs ? `/messages?${qs}` : '/messages'}
                  className="py-1 text-ink hover:text-indigo-deep"
                >
                  {f.name}
                </Link>
                <form action={deleteSavedFilter.bind(null, f.id)}>
                  <button
                    type="submit"
                    aria-label={`保存した条件「${f.name}」を削除`}
                    className="px-2 py-1 text-ink-muted hover:text-red-800"
                  >
                    ×
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      ) : null}

      {hasFilter ? (
        <form action={formAction} className="flex flex-wrap items-center gap-2">
          {SEARCH_KEYS.map((k) =>
            current[k] ? <input key={k} type="hidden" name={k} value={current[k]} /> : null,
          )}
          <input
            type="text"
            name="name"
            required
            maxLength={60}
            placeholder="この条件に名前を付けて保存"
            aria-label="フィルター名"
            className="min-w-0 flex-1 rounded-md border border-line bg-paper px-3 py-1.5 text-sm sm:max-w-xs"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-indigo-deep px-3 py-1.5 text-sm text-indigo-deep hover:bg-indigo-deep/5 disabled:opacity-50"
          >
            条件を保存
          </button>
          {state.error ? <span className="text-xs text-red-800">{state.error}</span> : null}
          {state.ok ? <span className="text-xs text-ink-muted">保存しました。</span> : null}
        </form>
      ) : null}
    </div>
  );
}
