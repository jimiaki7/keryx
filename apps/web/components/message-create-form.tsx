'use client';

import { useActionState, useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { createMessage, type CreateMessageState } from '@/app/(app)/messages/actions';

const initialState: CreateMessageState = {};

const TYPE_OPTIONS = [
  { value: 'sermon', label: '説教' },
  { value: 'prayer_meeting_exhortation', label: '祈祷会奨励' },
  { value: 'devotional', label: 'ディボーション' },
  { value: 'lecture', label: '講演' },
  { value: 'other', label: 'その他' },
];

/** 日本語IMEの変換確定Enterでフォームを送信しない */
function preventImeSubmit(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229)) {
    e.preventDefault();
  }
}

export function MessageCreateForm() {
  const [state, formAction, pending] = useActionState(createMessage, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok, state.nonce]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-lg border border-line bg-paper-raised p-4"
      aria-label="メッセージを作成"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="new-type" className="text-xs font-medium text-ink-muted">
            種別
          </label>
          <select
            id="new-type"
            name="type"
            defaultValue="sermon"
            className="rounded-md border border-line bg-paper px-2 py-2 text-sm"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="new-title" className="text-xs font-medium text-ink-muted">
            タイトル
          </label>
          <input
            id="new-title"
            name="title"
            type="text"
            maxLength={200}
            placeholder="例: 恐れるな、わたしはあなたとともにいる"
            onKeyDown={preventImeSubmit}
            className="rounded-md border border-line bg-paper px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1 sm:w-44">
          <label htmlFor="new-passage" className="text-xs font-medium text-ink-muted">
            聖書箇所（任意）
          </label>
          <input
            id="new-passage"
            name="passage"
            type="text"
            maxLength={100}
            placeholder="例: イザヤ41:10"
            onKeyDown={preventImeSubmit}
            className="rounded-md border border-line bg-paper px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-indigo-deep px-4 py-2 text-sm font-medium text-paper-raised hover:bg-indigo-soft disabled:opacity-50"
        >
          {pending ? '保存中…' : '保存'}
        </button>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        タイトルか聖書箇所のどちらかだけで保存できます。日付は後から割り当てられます。
      </p>
      {state.error ? (
        <div role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
          {state.suggestions && state.suggestions.length > 0 ? (
            <span className="block text-xs">候補: {state.suggestions.join('、')}</span>
          ) : null}
        </div>
      ) : null}
      {state.ok ? (
        <p role="status" className="mt-2 text-sm text-indigo-deep">
          保存しました。
        </p>
      ) : null}
    </form>
  );
}
