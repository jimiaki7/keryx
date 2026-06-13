'use client';

import { useActionState } from 'react';
import { VenueSelect } from '@/components/venue-select';
import { preachElsewhere, type PreachElsewhereState } from './actions';
import { GATHERING_KIND_LABELS } from '@/lib/labels';

const KIND_OPTIONS = Object.entries(GATHERING_KIND_LABELS);
const initial: PreachElsewhereState = {};

/**
 * 同じ説教を別の場所でも語るための複製フロー（Jimi 方針）。
 * 内容を複製した新しいメッセージを作り、その新しい場所・日時の礼拝予定を作成する。
 * メインの編集フォームの外に置く（フォームのネストを避ける）。
 */
export function PreachElsewhere({
  messageId,
  venues,
}: {
  messageId: string;
  venues: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    preachElsewhere.bind(null, messageId),
    initial,
  );

  return (
    <section
      aria-label="別の場所でも語る"
      className="rounded-lg border border-line bg-paper-raised p-4"
    >
      <details>
        <summary className="cursor-pointer text-sm font-medium text-ink">
          別の場所でも語る（複製）
        </summary>
        <p className="mt-2 text-xs text-ink-muted">
          同じ説教を別の場所で語るときに使います。この説教の内容（題・聖書箇所・中心メッセージ・
          アウトライン・ノート）を複製した新しいメッセージを作り、指定した日時・会場の礼拝予定を
          作成します。複製後に手を加えられます（元のメッセージは変更しません）。
        </p>
        <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="pe-starts" className="text-xs font-medium text-ink-muted">
              日時
            </label>
            <input
              id="pe-starts"
              name="starts_at_local"
              type="datetime-local"
              required
              className="rounded-md border border-line bg-paper px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="pe-kind" className="text-xs font-medium text-ink-muted">
              集会種別
            </label>
            <select
              id="pe-kind"
              name="kind"
              defaultValue="sunday_worship"
              className="rounded-md border border-line bg-paper px-2 py-1.5 text-sm"
            >
              {KIND_OPTIONS.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-ink-muted">会場</span>
            <VenueSelect name="venue" venues={venues} placeholder="会場を選択 / 追加" />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-indigo-deep px-4 py-2 text-sm font-medium text-paper-raised hover:bg-indigo-soft disabled:opacity-50"
          >
            {pending ? '複製中…' : '複製して機会を作成'}
          </button>
          {state.error ? <p className="w-full text-xs text-red-800">{state.error}</p> : null}
        </form>
      </details>
    </section>
  );
}
