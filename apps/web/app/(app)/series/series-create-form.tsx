'use client';

import { useActionState } from 'react';
import type { KeyboardEvent } from 'react';
import { createSeries, type SeriesFormState } from './actions';

const initialState: SeriesFormState = {};

/** 日本語IMEの変換確定Enterでフォームを送信しない */
function preventImeSubmit(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229)) {
    e.preventDefault();
  }
}

export function SeriesCreateForm() {
  const [state, formAction, pending] = useActionState(createSeries, initialState);

  return (
    <form
      action={formAction}
      aria-label="シリーズを作成"
      className="rounded-lg border border-line bg-paper-raised p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="new-series-name" className="text-xs font-medium text-ink-muted">
            シリーズ名
          </label>
          <input
            id="new-series-name"
            name="name"
            type="text"
            required
            maxLength={100}
            placeholder="例: 創世記連続講解"
            onKeyDown={preventImeSubmit}
            className="rounded-md border border-line bg-paper px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-indigo-deep px-4 py-2 text-sm font-medium text-paper-raised hover:bg-indigo-soft disabled:opacity-50"
        >
          {pending ? '作成中…' : '作成'}
        </button>
      </div>
      <p className="mt-2 text-xs text-ink-muted">説明・期間・書巻などは作成後に編集できます。</p>
      {state.error ? (
        <div role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </div>
      ) : null}
    </form>
  );
}
