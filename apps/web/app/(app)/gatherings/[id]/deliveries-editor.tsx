'use client';

import { useActionState, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { KeyboardEvent } from 'react';
import { addDelivery, removeDelivery, type SimpleFormState } from '../actions';

const initialState: SimpleFormState = {};

export type DeliveryItem = {
  id: string;
  speaker_name: string;
  message: { id: string; display_id: string; title: string };
};

export type MessageOption = { id: string; display_id: string; title: string };

/** 日本語IMEの変換確定Enterでフォームを送信しない */
function preventImeSubmit(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229)) {
    e.preventDefault();
  }
}

export function DeliveriesEditor({
  gatheringId,
  deliveries,
  candidates,
}: {
  gatheringId: string;
  deliveries: DeliveryItem[];
  candidates: MessageOption[];
}) {
  const [state, formAction, pending] = useActionState(
    addDelivery.bind(null, gatheringId),
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok, state.nonce]);

  return (
    <section
      aria-label="この集会で語る Message"
      className="rounded-lg border border-line bg-paper-raised p-4"
    >
      <h2 className="text-sm font-medium text-ink">この集会で語る Message</h2>
      {deliveries.length > 0 ? (
        <ul className="mt-2 divide-y divide-line">
          {deliveries.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2 py-2">
              <Link
                href={`/messages/${d.message.id}`}
                className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:text-indigo-deep hover:underline"
              >
                {d.message.title || '（無題）'}
              </Link>
              <span className="text-xs text-ink-muted">{d.message.display_id}</span>
              {d.speaker_name ? (
                <span className="text-xs text-ink-muted">説教者: {d.speaker_name}</span>
              ) : null}
              <form>
                <button
                  type="submit"
                  formAction={() => removeDelivery(d.id, gatheringId)}
                  aria-label="割り当てを外す"
                  className="rounded-md border border-line px-2 py-1.5 text-sm text-red-800 hover:bg-red-50"
                >
                  外す
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">Message は未定です（このまま保存できます）。</p>
      )}

      {candidates.length > 0 ? (
        <form ref={formRef} action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor="delivery-message" className="sr-only">
            割り当てる Message
          </label>
          <select
            id="delivery-message"
            name="message_id"
            defaultValue=""
            required
            className="min-w-48 flex-1 rounded-md border border-line bg-paper px-3 py-1.5 text-sm"
          >
            <option value="" disabled>
              Message を選択…
            </option>
            {candidates.map((m) => (
              <option key={m.id} value={m.id}>
                {(m.title || '（無題）') + ' — ' + m.display_id}
              </option>
            ))}
          </select>
          <input
            name="speaker_name"
            type="text"
            maxLength={100}
            placeholder="説教者（任意）"
            onKeyDown={preventImeSubmit}
            aria-label="説教者"
            className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-indigo-deep px-3 py-1.5 text-sm font-medium text-paper-raised hover:bg-indigo-soft disabled:opacity-50"
          >
            {pending ? '割り当て中…' : '割り当て'}
          </button>
        </form>
      ) : (
        <p className="mt-3 text-xs text-ink-muted">割り当てられる Message がありません。</p>
      )}
      {state.error ? (
        <div role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-1.5 text-sm text-red-800">
          {state.error}
        </div>
      ) : null}
    </section>
  );
}
