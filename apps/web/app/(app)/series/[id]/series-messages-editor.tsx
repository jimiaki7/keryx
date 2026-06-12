'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import {
  addMessageToSeries,
  moveSeriesMessage,
  removeSeriesMessage,
  type SeriesMessageState,
} from '../actions';

const initialState: SeriesMessageState = {};

export type SeriesMessageEntry = {
  id: string;
  position: number;
  message: {
    id: string;
    display_id: string;
    title: string;
    status: string;
  };
};

export type MessageOption = {
  id: string;
  display_id: string;
  title: string;
};

const iconButtonClass =
  'rounded-md border border-line px-2 py-1.5 text-sm text-ink-muted hover:bg-indigo-deep/5 disabled:opacity-30';

export function SeriesMessagesEditor({
  seriesId,
  entries,
  candidates,
}: {
  seriesId: string;
  entries: SeriesMessageEntry[];
  candidates: MessageOption[];
}) {
  const [addState, addAction, addPending] = useActionState(
    addMessageToSeries.bind(null, seriesId),
    initialState,
  );

  return (
    <section
      aria-label="シリーズ内の Message"
      className="rounded-lg border border-line bg-paper-raised p-4"
    >
      <h2 className="text-sm font-medium text-ink">シリーズ内の Message</h2>
      {entries.length > 0 ? (
        <ol className="mt-2 divide-y divide-line">
          {entries.map((entry, i) => (
            <li key={entry.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="w-6 text-right text-xs text-ink-muted">{i + 1}.</span>
              <Link
                href={`/messages/${entry.message.id}`}
                className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:text-indigo-deep hover:underline"
              >
                {entry.message.title || '（無題）'}
              </Link>
              <span className="text-xs text-ink-muted">{entry.message.display_id}</span>
              <form className="flex gap-1">
                <button
                  type="submit"
                  formAction={() => moveSeriesMessage(entry.id, seriesId, 'up')}
                  disabled={i === 0}
                  aria-label="上へ移動"
                  className={iconButtonClass}
                >
                  ↑
                </button>
                <button
                  type="submit"
                  formAction={() => moveSeriesMessage(entry.id, seriesId, 'down')}
                  disabled={i === entries.length - 1}
                  aria-label="下へ移動"
                  className={iconButtonClass}
                >
                  ↓
                </button>
                <button
                  type="submit"
                  formAction={() => removeSeriesMessage(entry.id, seriesId)}
                  aria-label="シリーズから外す"
                  className={`${iconButtonClass} text-red-800`}
                >
                  外す
                </button>
              </form>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">
          まだ Message がありません。下から追加できます（Message 自体は削除されません）。
        </p>
      )}

      {candidates.length > 0 ? (
        <form action={addAction} className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor="series-add-message" className="sr-only">
            追加する Message
          </label>
          <select
            id="series-add-message"
            name="message_id"
            defaultValue=""
            required
            className="min-w-48 flex-1 rounded-md border border-line bg-paper px-3 py-1.5 text-sm"
          >
            <option value="" disabled>
              Message を選択…
            </option>
            {candidates.map((m) => (
              <option key={m.id} value={m.id}>
                {(m.title || '（無題）') + ' — ' + m.display_id}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={addPending}
            className="rounded-md bg-indigo-deep px-3 py-1.5 text-sm font-medium text-paper-raised hover:bg-indigo-soft disabled:opacity-50"
          >
            {addPending ? '追加中…' : 'シリーズに追加'}
          </button>
        </form>
      ) : (
        <p className="mt-3 text-xs text-ink-muted">追加できる Message がありません。</p>
      )}
      {addState.error ? (
        <div role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-1.5 text-sm text-red-800">
          {addState.error}
        </div>
      ) : null}
    </section>
  );
}
