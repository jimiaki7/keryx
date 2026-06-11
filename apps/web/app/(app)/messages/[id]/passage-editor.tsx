'use client';

import { useActionState, useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import {
  addPassage,
  deletePassage,
  movePassage,
  updatePassage,
  type PassageFormState,
} from './actions';

const initialState: PassageFormState = {};

export type PassageItem = {
  id: string;
  role: string;
  position: number;
  display_text: string;
};

/** 日本語IMEの変換確定Enterでフォームを送信しない */
function preventImeSubmit(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229)) {
    e.preventDefault();
  }
}

function PassageError({ state }: { state: PassageFormState }) {
  if (!state.error) return null;
  return (
    <div role="alert" className="mt-1 rounded-md bg-red-50 px-3 py-1.5 text-xs text-red-800">
      {state.error}
      {state.suggestions && state.suggestions.length > 0 ? (
        <span className="block">候補: {state.suggestions.join('、')}</span>
      ) : null}
    </div>
  );
}

const inputClass = 'rounded-md border border-line bg-paper px-3 py-1.5 text-sm';
const iconButtonClass =
  'rounded-md border border-line px-2 py-1.5 text-sm text-ink-muted hover:bg-indigo-deep/5 disabled:opacity-30';

function PassageRow({
  passage,
  messageId,
  isFirst,
  isLast,
}: {
  passage: PassageItem;
  messageId: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updatePassage.bind(null, passage.id, messageId),
    initialState,
  );

  return (
    <li className="py-2">
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input
          name="text"
          type="text"
          defaultValue={passage.display_text}
          maxLength={100}
          onKeyDown={preventImeSubmit}
          aria-label="聖書箇所"
          className={`${inputClass} min-w-40 flex-1`}
        />
        <select
          name="role"
          defaultValue={passage.role}
          aria-label="箇所の区分"
          className={inputClass}
        >
          <option value="primary">主たる箇所</option>
          <option value="supporting">補助箇所</option>
        </select>
        <button type="submit" disabled={pending} className={iconButtonClass}>
          更新
        </button>
        <button
          type="submit"
          formAction={() => movePassage(passage.id, messageId, 'up')}
          disabled={isFirst}
          aria-label="上へ移動"
          className={iconButtonClass}
        >
          ↑
        </button>
        <button
          type="submit"
          formAction={() => movePassage(passage.id, messageId, 'down')}
          disabled={isLast}
          aria-label="下へ移動"
          className={iconButtonClass}
        >
          ↓
        </button>
        <button
          type="submit"
          formAction={() => deletePassage(passage.id, messageId)}
          aria-label="この箇所を削除"
          className={`${iconButtonClass} text-red-800`}
        >
          削除
        </button>
      </form>
      <PassageError state={state} />
    </li>
  );
}

export function PassageEditor({
  messageId,
  passages,
}: {
  messageId: string;
  passages: PassageItem[];
}) {
  const [addState, addAction, addPending] = useActionState(
    addPassage.bind(null, messageId),
    initialState,
  );
  const addFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (addState.ok) addFormRef.current?.reset();
  }, [addState.ok, addState.nonce]);

  return (
    <section aria-label="聖書箇所" className="rounded-lg border border-line bg-paper-raised p-4">
      <h2 className="text-sm font-medium text-ink">聖書箇所</h2>
      {passages.length > 0 ? (
        <ul className="mt-2 divide-y divide-line">
          {passages.map((p, i) => (
            <PassageRow
              key={p.id}
              passage={p}
              messageId={messageId}
              isFirst={i === 0}
              isLast={i === passages.length - 1}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">まだ聖書箇所がありません。</p>
      )}
      <form ref={addFormRef} action={addAction} className="mt-3 flex flex-wrap items-center gap-2">
        <input
          name="text"
          type="text"
          maxLength={100}
          placeholder="例: ヨハネ3:16-21"
          onKeyDown={preventImeSubmit}
          aria-label="追加する聖書箇所"
          className={`${inputClass} min-w-40 flex-1`}
        />
        <select
          name="role"
          defaultValue="supporting"
          aria-label="箇所の区分"
          className={inputClass}
        >
          <option value="primary">主たる箇所</option>
          <option value="supporting">補助箇所</option>
        </select>
        <button
          type="submit"
          disabled={addPending}
          className="rounded-md bg-indigo-deep px-3 py-1.5 text-sm font-medium text-paper-raised hover:bg-indigo-soft disabled:opacity-50"
        >
          {addPending ? '追加中…' : '追加'}
        </button>
      </form>
      <PassageError state={addState} />
    </section>
  );
}
