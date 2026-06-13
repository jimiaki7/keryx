'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import type { KeyboardEvent } from 'react';
import { VenueSelect } from '@/components/venue-select';
import { GATHERING_KIND_LABELS } from '@/lib/labels';
import {
  removeSpeakingOpportunity,
  softDeleteMessage,
  updateMessage,
  type UpdateMessageState,
} from './actions';

const initialState: UpdateMessageState = {};

const TYPE_OPTIONS = [
  { value: 'sermon', label: '説教' },
  { value: 'prayer_meeting_exhortation', label: '祈祷会奨励' },
  { value: 'devotional', label: 'ディボーション' },
  { value: 'lecture', label: '講演' },
  { value: 'other', label: 'その他' },
];

const STATUS_OPTIONS = [
  { value: 'planned', label: '計画中' },
  { value: 'preparing', label: '準備中' },
  { value: 'ready', label: '準備完了' },
  { value: 'completed', label: '完了' },
  { value: 'archived', label: 'アーカイブ' },
];

const KIND_OPTIONS = Object.entries(GATHERING_KIND_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/** 日本語IMEの変換確定Enterでフォームを送信しない */
function preventImeSubmit(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229)) {
    e.preventDefault();
  }
}

function formatTokyo(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export type OpportunityItem = {
  id: string;
  speaker_name: string;
  gathering: {
    id: string;
    display_id: string;
    title: string;
    kind: string;
    starts_at: string;
    venue_name: string | null;
  };
};

export type EditableMessage = {
  id: string;
  display_id: string;
  type: string;
  status: string;
  title: string;
  central_message: string;
  summary: string;
  outline_markdown: string;
  notes_markdown: string;
  version: number;
};

const inputClass = 'rounded-md border border-line bg-paper px-3 py-2 text-sm';
const labelClass = 'text-xs font-medium text-ink-muted';

export function MessageEditor({
  message,
  opportunities,
  venues,
  defaultOppStartsAt = '',
}: {
  message: EditableMessage;
  opportunities: OpportunityItem[];
  venues: { id: string; name: string }[];
  // カレンダーの「＋」から渡される語る機会日時の初期値（YYYY-MM-DDTHH:mm）。未指定は空。
  defaultOppStartsAt?: string;
}) {
  const [state, formAction, pending] = useActionState(updateMessage, initialState);
  // 保存成功時はサーバーが返した新しい version を使う（楽観ロック用）
  const version = state.version ?? message.version;
  const [dirty, setDirty] = useState(false);

  const markDirty = () => setDirty(true);

  return (
    <form
      action={formAction}
      onInput={markDirty}
      onSubmit={() => setDirty(false)}
      className="flex flex-col gap-5"
    >
      <input type="hidden" name="id" value={message.id} />
      <input type="hidden" name="version" value={version} />

      <section aria-label="語る機会" className="rounded-lg border border-line bg-paper-raised p-4">
        <h2 className="text-sm font-medium text-ink">語る機会</h2>
        {opportunities.length > 0 ? (
          <ul className="mt-2 divide-y divide-line">
            {opportunities.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2 py-2">
                <Link
                  href={`/gatherings/${o.gathering.id}`}
                  className="text-sm font-medium text-ink hover:text-indigo-deep hover:underline"
                >
                  {o.gathering.title || GATHERING_KIND_LABELS[o.gathering.kind] || o.gathering.kind}
                </Link>
                <time dateTime={o.gathering.starts_at} className="text-sm text-indigo-soft">
                  {formatTokyo(o.gathering.starts_at)}
                </time>
                {o.gathering.venue_name ? (
                  <span className="text-xs text-ink-muted">{o.gathering.venue_name}</span>
                ) : null}
                {o.speaker_name ? (
                  <span className="text-xs text-ink-muted">説教者: {o.speaker_name}</span>
                ) : null}
                <button
                  type="submit"
                  formAction={() => removeSpeakingOpportunity(o.id, message.id)}
                  aria-label="この機会を外す"
                  className="ml-auto rounded-md border border-line px-2 py-1.5 text-sm text-red-800 hover:bg-red-50"
                >
                  外す
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <fieldset
          key={state.nonce ?? 'initial'}
          className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="opp-starts" className={labelClass}>
              日時
            </label>
            <input
              id="opp-starts"
              name="opp_starts_at_local"
              type="datetime-local"
              defaultValue={defaultOppStartsAt}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="opp-kind" className={labelClass}>
              集会種別
            </label>
            <select
              id="opp-kind"
              name="opp_kind"
              defaultValue="sunday_worship"
              className={inputClass}
            >
              {KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className={labelClass}>会場（任意）</span>
            <VenueSelect name="opp_venue" venues={venues} placeholder="会場を選択 / 追加" />
          </div>
        </fieldset>
      </section>

      <section className="rounded-lg border border-line bg-paper-raised p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-col gap-1">
              <label htmlFor="edit-type" className={labelClass}>
                種別
              </label>
              <select
                id="edit-type"
                name="type"
                defaultValue={message.type}
                onChange={markDirty}
                className={inputClass}
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="edit-status" className={labelClass}>
                状態
              </label>
              <select
                id="edit-status"
                name="status"
                defaultValue={message.status}
                onChange={markDirty}
                className={inputClass}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-title" className={labelClass}>
              タイトル
            </label>
            <input
              id="edit-title"
              name="title"
              type="text"
              maxLength={200}
              defaultValue={message.title}
              onKeyDown={preventImeSubmit}
              className={`${inputClass} text-base`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-central" className={labelClass}>
              中心メッセージ（一文）
            </label>
            <input
              id="edit-central"
              name="central_message"
              type="text"
              maxLength={500}
              defaultValue={message.central_message}
              onKeyDown={preventImeSubmit}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-paper-raised p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-summary" className={labelClass}>
              概要
            </label>
            <textarea
              id="edit-summary"
              name="summary"
              rows={3}
              maxLength={2000}
              defaultValue={message.summary}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-outline" className={labelClass}>
              アウトライン（Markdown）
            </label>
            <textarea
              id="edit-outline"
              name="outline_markdown"
              rows={8}
              defaultValue={message.outline_markdown}
              className={`${inputClass} font-mono text-xs leading-relaxed`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-notes" className={labelClass}>
              ノート（Markdown）
            </label>
            <textarea
              id="edit-notes"
              name="notes_markdown"
              rows={8}
              defaultValue={message.notes_markdown}
              className={`${inputClass} font-mono text-xs leading-relaxed`}
            />
          </div>
        </div>
      </section>

      <div className="sticky bottom-20 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-paper-raised px-4 py-3 md:bottom-4">
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

export function MessageDeleteButton({ messageId }: { messageId: string }) {
  return (
    <form
      action={softDeleteMessage}
      onSubmit={(e) => {
        if (
          !window.confirm('このメッセージを削除しますか？（復元は今後のバージョンで対応します）')
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={messageId} />
      <button
        type="submit"
        className="rounded-md border border-line px-3 py-1.5 text-sm text-red-800 hover:bg-red-50"
      >
        削除
      </button>
    </form>
  );
}
