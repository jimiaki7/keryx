'use client';

import { useActionState, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { updateGathering, type GatheringFormState } from '../actions';

const initialState: GatheringFormState = {};

const KIND_OPTIONS = [
  { value: 'sunday_worship', label: '主日礼拝' },
  { value: 'prayer_meeting', label: '祈祷会' },
  { value: 'special_service', label: '特別礼拝' },
  { value: 'chapel', label: 'チャペル' },
  { value: 'other', label: 'その他' },
];

const STATUS_OPTIONS = [
  { value: 'draft', label: '下書き' },
  { value: 'scheduled', label: '予定' },
  { value: 'completed', label: '実施済み' },
  { value: 'canceled', label: '中止' },
];

/** 日本語IMEの変換確定Enterでフォームを送信しない */
function preventImeSubmit(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229)) {
    e.preventDefault();
  }
}

export type EditableGathering = {
  id: string;
  title: string;
  kind: string;
  status: string;
  starts_at_local: string;
  venue_name: string;
  audience: string;
  notes: string;
  version: number;
};

const inputClass = 'rounded-md border border-line bg-paper px-3 py-2 text-sm';
const labelClass = 'text-xs font-medium text-ink-muted';

export function GatheringEditor({ gathering }: { gathering: EditableGathering }) {
  const [state, formAction, pending] = useActionState(updateGathering, initialState);
  const version = state.version ?? gathering.version;
  const [dirty, setDirty] = useState(false);

  return (
    <form
      action={formAction}
      onInput={() => setDirty(true)}
      onSubmit={() => setDirty(false)}
      className="flex flex-col gap-4 rounded-lg border border-line bg-paper-raised p-4"
    >
      <input type="hidden" name="id" value={gathering.id} />
      <input type="hidden" name="version" value={version} />

      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="g-kind" className={labelClass}>
            集会種別
          </label>
          <select
            id="g-kind"
            name="kind"
            defaultValue={gathering.kind}
            onChange={() => setDirty(true)}
            className={inputClass}
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="g-status" className={labelClass}>
            状態
          </label>
          <select
            id="g-status"
            name="status"
            defaultValue={gathering.status}
            onChange={() => setDirty(true)}
            className={inputClass}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="g-starts" className={labelClass}>
            日時（Asia/Tokyo）
          </label>
          <input
            id="g-starts"
            name="starts_at_local"
            type="datetime-local"
            required
            defaultValue={gathering.starts_at_local}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="g-venue" className={labelClass}>
            会場
          </label>
          <input
            id="g-venue"
            name="venue_name"
            type="text"
            maxLength={100}
            defaultValue={gathering.venue_name}
            placeholder="例: 本会堂"
            onKeyDown={preventImeSubmit}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="g-title" className={labelClass}>
          タイトル（任意。空なら集会種別を表示）
        </label>
        <input
          id="g-title"
          name="title"
          type="text"
          maxLength={100}
          defaultValue={gathering.title}
          onKeyDown={preventImeSubmit}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="g-audience" className={labelClass}>
          対象・会衆（任意）
        </label>
        <input
          id="g-audience"
          name="audience"
          type="text"
          maxLength={200}
          defaultValue={gathering.audience}
          onKeyDown={preventImeSubmit}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="g-notes" className={labelClass}>
          メモ
        </label>
        <textarea
          id="g-notes"
          name="notes"
          rows={3}
          maxLength={5000}
          defaultValue={gathering.notes}
          className={inputClass}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-indigo-deep px-5 py-2 text-sm font-medium text-paper-raised hover:bg-indigo-soft disabled:opacity-50"
        >
          {pending ? '保存中…' : '保存'}
        </button>
        <span aria-live="polite" className="text-sm">
          {state.error ? (
            <span role="alert" className="text-red-800">
              {state.error}
            </span>
          ) : dirty ? (
            <span className="text-gold">未保存の変更があります</span>
          ) : state.ok ? (
            <span className="text-indigo-deep">保存しました</span>
          ) : null}
        </span>
      </div>
    </form>
  );
}
