'use client';

import { useActionState, type KeyboardEvent } from 'react';
import {
  addObservance,
  deleteObservance,
  updateObservance,
  type ObservanceFormState,
} from './actions';

export type ObservanceRow = {
  id: string;
  name: string;
  kind: string;
  starts_on: string;
  ends_on: string;
  color: string;
  source: string;
};

const initial: ObservanceFormState = {};

/** 変換確定 Enter での誤送信を防ぐ */
function imeGuard(e: KeyboardEvent<HTMLInputElement>) {
  const n = e.nativeEvent as unknown as { isComposing?: boolean; keyCode?: number };
  if (e.key === 'Enter' && (n.isComposing || n.keyCode === 229)) e.preventDefault();
}

function dateRange(o: ObservanceRow): string {
  return o.starts_on === o.ends_on ? o.starts_on : `${o.starts_on} 〜 ${o.ends_on}`;
}

export function ObservanceManager({ observances }: { observances: ObservanceRow[] }) {
  const [state, formAction, pending] = useActionState(addObservance, initial);

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="登録済みの教会暦" className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ink">登録済みの教会暦・行事</h2>
        {observances.length === 0 ? (
          <p className="text-sm text-ink-muted">
            まだありません。下でプリセットを適用するか、独自に追加してください。
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {observances.map((o) => (
              <li key={o.id} className="rounded-lg border border-line bg-paper-raised px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span
                    aria-hidden
                    className="inline-block h-3 w-3 shrink-0 rounded-full border border-line"
                    style={{ backgroundColor: o.color || '#475569' }}
                  />
                  <span className="font-medium text-ink">{o.name}</span>
                  <span className="text-sm text-ink-muted">{dateRange(o)}</span>
                  <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-muted">
                    {o.source === 'preset' ? 'プリセット' : '独自'}
                  </span>
                  <details className="ml-auto">
                    <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">
                      編集
                    </summary>
                    <div className="mt-3 flex flex-col gap-3">
                      <form
                        action={updateObservance.bind(null, o.id)}
                        className="flex flex-wrap items-end gap-2"
                      >
                        <label className="flex flex-col gap-1">
                          <span className="text-xs text-ink-muted">名称</span>
                          <input
                            type="text"
                            name="name"
                            defaultValue={o.name}
                            required
                            maxLength={80}
                            onKeyDown={imeGuard}
                            className="rounded-md border border-line bg-paper px-2 py-1.5 text-sm"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-xs text-ink-muted">開始</span>
                          <input
                            type="date"
                            name="starts_on"
                            defaultValue={o.starts_on}
                            required
                            className="rounded-md border border-line bg-paper px-2 py-1.5 text-sm"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-xs text-ink-muted">終了</span>
                          <input
                            type="date"
                            name="ends_on"
                            defaultValue={o.ends_on}
                            required
                            className="rounded-md border border-line bg-paper px-2 py-1.5 text-sm"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-xs text-ink-muted">色</span>
                          <input
                            type="color"
                            name="color"
                            defaultValue={o.color || '#475569'}
                            className="h-9 w-12 rounded-md border border-line bg-paper"
                          />
                        </label>
                        <button
                          type="submit"
                          className="rounded-md border border-indigo-deep px-3 py-1.5 text-sm text-indigo-deep hover:bg-indigo-deep/5"
                        >
                          保存
                        </button>
                      </form>
                      <form action={deleteObservance.bind(null, o.id)}>
                        <button type="submit" className="text-xs text-ink-muted hover:text-red-800">
                          この教会暦を削除
                        </button>
                      </form>
                    </div>
                  </details>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-label="独自の教会暦を追加"
        className="rounded-lg border border-line bg-paper-raised p-4"
      >
        <h2 className="text-sm font-medium text-ink">独自に追加</h2>
        <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-xs text-ink-muted">名称</span>
            <input
              type="text"
              name="name"
              required
              maxLength={80}
              onKeyDown={imeGuard}
              placeholder="例: 教会創立記念日"
              className="rounded-md border border-line bg-paper px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-muted">開始</span>
            <input
              type="date"
              name="starts_on"
              required
              className="rounded-md border border-line bg-paper px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-muted">終了</span>
            <input
              type="date"
              name="ends_on"
              required
              className="rounded-md border border-line bg-paper px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-muted">色</span>
            <input
              type="color"
              name="color"
              defaultValue="#475569"
              className="h-9 w-12 rounded-md border border-line bg-paper"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-indigo-deep px-4 py-2 text-sm font-medium text-paper-raised hover:bg-indigo-soft disabled:opacity-50"
          >
            追加
          </button>
          {state.error ? <p className="w-full text-xs text-red-800">{state.error}</p> : null}
          {state.ok ? <p className="w-full text-xs text-ink-muted">追加しました。</p> : null}
        </form>
      </section>
    </div>
  );
}
