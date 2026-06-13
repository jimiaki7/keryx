'use client';

import Link from 'next/link';
import type { KeyboardEvent } from 'react';
import type { MessageSearchParams } from '@/lib/message-search';
import { MESSAGE_STATUS_LABELS, MESSAGE_TYPE_LABELS } from '@/lib/labels';

type SeriesOption = { id: string; name: string };

const TYPE_OPTIONS = Object.entries(MESSAGE_TYPE_LABELS);
const STATUS_OPTIONS = Object.entries(MESSAGE_STATUS_LABELS);

/** 日本語入力の変換確定 Enter でフォーム送信しない（確定のための Enter を誤送信にしない） */
function imeGuard(e: KeyboardEvent<HTMLInputElement>) {
  const native = e.nativeEvent as unknown as { isComposing?: boolean; keyCode?: number };
  if (e.key === 'Enter' && (native.isComposing || native.keyCode === 229)) {
    e.preventDefault();
  }
}

export function MessageSearchForm({
  params,
  series,
  hasFilter,
}: {
  params: MessageSearchParams;
  series: SeriesOption[];
  hasFilter: boolean;
}) {
  const advancedOpen = !!(
    params.type ||
    params.status ||
    params.series ||
    params.venue ||
    params.speaker ||
    params.from ||
    params.to
  );

  return (
    <form
      method="get"
      action="/messages"
      role="search"
      className="flex flex-col gap-3 rounded-lg border border-line bg-paper-raised p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={params.q ?? ''}
          onKeyDown={imeGuard}
          placeholder="タイトル・聖書箇所・中心メッセージ・主題で検索"
          aria-label="キーワード検索"
          className="min-w-0 flex-1 rounded-md border border-line bg-paper px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-indigo-deep px-4 py-2 text-sm font-medium text-paper-raised hover:bg-indigo-soft"
        >
          検索
        </button>
        {hasFilter ? (
          <Link
            href="/messages"
            className="rounded-md border border-line px-3 py-2 text-sm text-ink-muted hover:bg-indigo-deep/5"
          >
            クリア
          </Link>
        ) : null}
      </div>

      <details open={advancedOpen} className="text-sm">
        <summary className="cursor-pointer text-ink-muted hover:text-ink">詳細フィルター</summary>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-muted">種別</span>
            <select
              name="type"
              defaultValue={params.type ?? ''}
              className="rounded-md border border-line bg-paper px-2 py-1.5"
            >
              <option value="">すべて</option>
              {TYPE_OPTIONS.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-muted">状態</span>
            <select
              name="status"
              defaultValue={params.status ?? ''}
              className="rounded-md border border-line bg-paper px-2 py-1.5"
            >
              <option value="">すべて</option>
              {STATUS_OPTIONS.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-muted">シリーズ</span>
            <select
              name="series"
              defaultValue={params.series ?? ''}
              className="rounded-md border border-line bg-paper px-2 py-1.5"
            >
              <option value="">すべて</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-muted">会場</span>
            <input
              type="text"
              name="venue"
              defaultValue={params.venue ?? ''}
              onKeyDown={imeGuard}
              className="rounded-md border border-line bg-paper px-2 py-1.5"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-muted">説教者</span>
            <input
              type="text"
              name="speaker"
              defaultValue={params.speaker ?? ''}
              onKeyDown={imeGuard}
              className="rounded-md border border-line bg-paper px-2 py-1.5"
            />
          </label>
          <div className="flex items-end gap-2">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs text-ink-muted">日付（から）</span>
              <input
                type="date"
                name="from"
                defaultValue={params.from ?? ''}
                className="rounded-md border border-line bg-paper px-2 py-1.5"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs text-ink-muted">日付（まで）</span>
              <input
                type="date"
                name="to"
                defaultValue={params.to ?? ''}
                className="rounded-md border border-line bg-paper px-2 py-1.5"
              />
            </label>
          </div>
        </div>
      </details>
    </form>
  );
}
