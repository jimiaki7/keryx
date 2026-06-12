'use client';

import { useActionState } from 'react';
import type { KeyboardEvent } from 'react';
import { createGathering, type GatheringFormState } from './actions';

const initialState: GatheringFormState = {};

const KIND_OPTIONS = [
  { value: 'sunday_worship', label: '主日礼拝' },
  { value: 'prayer_meeting', label: '祈祷会' },
  { value: 'special_service', label: '特別礼拝' },
  { value: 'chapel', label: 'チャペル' },
  { value: 'other', label: 'その他' },
];

/** 日本語IMEの変換確定Enterでフォームを送信しない */
function preventImeSubmit(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229)) {
    e.preventDefault();
  }
}

export function GatheringCreateForm({
  defaultStartsAt,
}: {
  defaultStartsAt?: string | undefined;
}) {
  const [state, formAction, pending] = useActionState(createGathering, initialState);

  return (
    <form
      action={formAction}
      aria-label="礼拝予定を作成"
      className="rounded-lg border border-line bg-paper-raised p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="new-gathering-kind" className="text-xs font-medium text-ink-muted">
            集会種別
          </label>
          <select
            id="new-gathering-kind"
            name="kind"
            defaultValue="sunday_worship"
            className="rounded-md border border-line bg-paper px-2 py-2 text-sm"
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="new-gathering-starts" className="text-xs font-medium text-ink-muted">
            日時
          </label>
          <input
            id="new-gathering-starts"
            name="starts_at_local"
            type="datetime-local"
            required
            defaultValue={defaultStartsAt}
            className="rounded-md border border-line bg-paper px-3 py-2 text-sm"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="new-gathering-venue" className="text-xs font-medium text-ink-muted">
            会場（任意）
          </label>
          <input
            id="new-gathering-venue"
            name="venue_name"
            type="text"
            maxLength={100}
            placeholder="例: 本会堂"
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
      <p className="mt-2 text-xs text-ink-muted">
        Message は未定のままで保存できます。礼拝順序は作成後に編集します。
      </p>
      {state.error ? (
        <div role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </div>
      ) : null}
    </form>
  );
}
