'use client';

import { useActionState, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { updateSeries, type SeriesFormState } from '../actions';

const initialState: SeriesFormState = {};

const STATUS_OPTIONS = [
  { value: 'planned', label: '計画中' },
  { value: 'active', label: '進行中' },
  { value: 'paused', label: '休止中' },
  { value: 'completed', label: '完了' },
  { value: 'archived', label: 'アーカイブ' },
];

const COLOR_OPTIONS = [
  { value: '', label: 'なし' },
  { value: '#1e2a4a', label: '藍' },
  { value: '#b08d3e', label: '金' },
  { value: '#3f6b4f', label: '緑' },
  { value: '#6b3f63', label: '紫' },
  { value: '#8c3b3b', label: '赤' },
  { value: '#5a6472', label: '灰' },
];

/** 日本語IMEの変換確定Enterでフォームを送信しない */
function preventImeSubmit(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229)) {
    e.preventDefault();
  }
}

export type EditableSeries = {
  id: string;
  name: string;
  description: string;
  goal: string;
  status: string;
  color: string;
  starts_on: string | null;
  ends_on: string | null;
  primary_book_id: string | null;
  version: number;
};

export type BookOption = { osis: string; name_ja: string };

const inputClass = 'rounded-md border border-line bg-paper px-3 py-2 text-sm';
const labelClass = 'text-xs font-medium text-ink-muted';

export function SeriesEditor({ series, books }: { series: EditableSeries; books: BookOption[] }) {
  const [state, formAction, pending] = useActionState(updateSeries, initialState);
  const version = state.version ?? series.version;
  const [dirty, setDirty] = useState(false);

  return (
    <form
      action={formAction}
      onInput={() => setDirty(true)}
      onSubmit={() => setDirty(false)}
      className="flex flex-col gap-4 rounded-lg border border-line bg-paper-raised p-4"
    >
      <input type="hidden" name="id" value={series.id} />
      <input type="hidden" name="version" value={version} />

      <div className="flex flex-col gap-1">
        <label htmlFor="series-name" className={labelClass}>
          シリーズ名
        </label>
        <input
          id="series-name"
          name="name"
          type="text"
          required
          maxLength={100}
          defaultValue={series.name}
          onKeyDown={preventImeSubmit}
          className={`${inputClass} text-base`}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="series-status" className={labelClass}>
            状態
          </label>
          <select
            id="series-status"
            name="status"
            defaultValue={series.status}
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
          <label htmlFor="series-color" className={labelClass}>
            色
          </label>
          <select
            id="series-color"
            name="color"
            defaultValue={series.color}
            onChange={() => setDirty(true)}
            className={inputClass}
          >
            {COLOR_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="series-book" className={labelClass}>
            主な書巻
          </label>
          <select
            id="series-book"
            name="primary_book_id"
            defaultValue={series.primary_book_id ?? ''}
            onChange={() => setDirty(true)}
            className={inputClass}
          >
            <option value="">なし</option>
            {books.map((b) => (
              <option key={b.osis} value={b.osis}>
                {b.name_ja}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="series-starts" className={labelClass}>
            開始日
          </label>
          <input
            id="series-starts"
            name="starts_on"
            type="date"
            defaultValue={series.starts_on ?? ''}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="series-ends" className={labelClass}>
            終了日
          </label>
          <input
            id="series-ends"
            name="ends_on"
            type="date"
            defaultValue={series.ends_on ?? ''}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="series-description" className={labelClass}>
          説明
        </label>
        <textarea
          id="series-description"
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={series.description}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="series-goal" className={labelClass}>
          目標
        </label>
        <textarea
          id="series-goal"
          name="goal"
          rows={2}
          maxLength={1000}
          defaultValue={series.goal}
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
