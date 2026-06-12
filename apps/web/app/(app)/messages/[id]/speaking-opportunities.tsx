'use client';

import { useActionState, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { KeyboardEvent } from 'react';
import { GATHERING_KIND_LABELS } from '@/lib/labels';
import {
  addSpeakingOpportunity,
  removeSpeakingOpportunity,
  type OpportunityFormState,
} from './actions';

const initialState: OpportunityFormState = {};

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

const inputClass = 'rounded-md border border-line bg-paper px-3 py-1.5 text-sm';

export function SpeakingOpportunities({
  messageId,
  opportunities,
}: {
  messageId: string;
  opportunities: OpportunityItem[];
}) {
  const [state, formAction, pending] = useActionState(
    addSpeakingOpportunity.bind(null, messageId),
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok, state.nonce]);

  return (
    <section aria-label="語る機会" className="rounded-lg border border-line bg-paper-raised p-4">
      <h2 className="text-sm font-medium text-ink">語る機会</h2>
      <p className="mt-1 text-xs text-ink-muted">
        同じ Message を複数の日時・会場で語れます。原稿は共有され、実施履歴は別々に残ります。
      </p>
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
              <form className="ml-auto">
                <button
                  type="submit"
                  formAction={() => removeSpeakingOpportunity(o.id, messageId)}
                  aria-label="この機会の関連付けを外す"
                  className="rounded-md border border-line px-2 py-1.5 text-sm text-red-800 hover:bg-red-50"
                >
                  外す
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">まだ語る機会が設定されていません。</p>
      )}

      <form ref={formRef} action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="opp-starts" className="text-xs font-medium text-ink-muted">
            日時
          </label>
          <input
            id="opp-starts"
            name="starts_at_local"
            type="datetime-local"
            required
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="opp-kind" className="text-xs font-medium text-ink-muted">
            集会種別
          </label>
          <select id="opp-kind" name="kind" defaultValue="sunday_worship" className={inputClass}>
            {KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="opp-venue" className="text-xs font-medium text-ink-muted">
            会場（任意）
          </label>
          <input
            id="opp-venue"
            name="venue_name"
            type="text"
            maxLength={100}
            placeholder="例: 別会場"
            onKeyDown={preventImeSubmit}
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-indigo-deep px-3 py-1.5 text-sm font-medium text-paper-raised hover:bg-indigo-soft disabled:opacity-50"
        >
          {pending ? '追加中…' : '語る機会を追加'}
        </button>
      </form>
      {state.error ? (
        <div role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-1.5 text-sm text-red-800">
          {state.error}
        </div>
      ) : null}
    </section>
  );
}
