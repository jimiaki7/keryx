'use client';

import { useState, useTransition } from 'react';
import { AI_SUGGESTION_KIND_LABELS } from '@/lib/labels';
import {
  type AiSuggestState,
  approveSuggestion,
  generateSuggestion,
  rejectSuggestion,
} from './ai-actions';

export type PendingSuggestion = {
  id: string;
  kind: string;
  content: string;
  model: string;
};

/**
 * AI 支援（E12 土台）。AI は「助手であり権威ではない」（SPEC §4.5）。
 * 提案は未承認として明確に区別して表示し、承認して初めて本文（messages）へ反映する。
 * サーバー未設定（ANTHROPIC_API_KEY なし）のときは生成導線を出さない。
 */
export function AiSuggestions({
  messageId,
  configured,
  suggestions,
}: {
  messageId: string;
  configured: boolean;
  suggestions: readonly PendingSuggestion[];
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<AiSuggestState>({});

  const run = (fn: () => Promise<AiSuggestState>) => {
    startTransition(async () => {
      setState(await fn());
    });
  };

  return (
    <section
      aria-label="AI 支援"
      aria-busy={pending}
      className="rounded-lg border border-line bg-paper-raised p-4"
    >
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium text-ink">AI 支援</h2>
        <span className="rounded-full border border-gold/40 bg-gold/5 px-2 py-0.5 text-[11px] text-gold">
          β
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        AI
        は準備の助手です。提案は承認するまで本文に反映されません。聖書本文・出典の捏造には注意し、必ずご自身で確認してください。
      </p>
      <p className="mt-1 text-xs text-ink-muted">
        候補を生成すると、このメッセージのタイトル・中心メッセージ・アウトライン・ノートが AI
        提供元（Anthropic）へ送信されます。
      </p>

      {!configured ? (
        <p className="mt-3 rounded-md border border-line bg-paper px-3 py-2 text-xs text-ink-muted">
          AI 支援は未設定です。サーバーに <code>ANTHROPIC_API_KEY</code>{' '}
          を設定すると、概要・中心メッセージの候補を生成できます。
        </p>
      ) : (
        <div
          role="group"
          aria-label="候補を生成"
          className={`mt-3 flex flex-wrap gap-2 ${pending ? 'opacity-60' : ''}`}
        >
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => generateSuggestion(messageId, 'summary'))}
            className="rounded-md border border-line px-3 py-1.5 text-sm text-indigo-deep hover:bg-indigo-deep/5 disabled:opacity-50"
          >
            概要を提案
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => generateSuggestion(messageId, 'central_message'))}
            className="rounded-md border border-line px-3 py-1.5 text-sm text-indigo-deep hover:bg-indigo-deep/5 disabled:opacity-50"
          >
            中心メッセージを提案
          </button>
        </div>
      )}

      <div aria-live="polite" className="mt-2 min-h-[1rem] text-xs">
        {state.error ? <span className="text-red-700">{state.error}</span> : null}
        {state.info ? <span className="text-ink-muted">{state.info}</span> : null}
      </div>

      {suggestions.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-2">
          {suggestions.map((s) => (
            <li key={s.id} className="rounded-md border border-gold/30 bg-gold/5 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-gold/40 px-2 py-0.5 text-[11px] text-gold">
                  AI 提案（未承認）
                </span>
                <span className="text-xs text-ink-muted">
                  {AI_SUGGESTION_KIND_LABELS[s.kind] ?? s.kind}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{s.content}</p>
              <div className={`mt-2 flex items-center gap-2 ${pending ? 'opacity-60' : ''}`}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => approveSuggestion(s.id, messageId))}
                  className="rounded-md border border-indigo-deep bg-indigo-deep px-3 py-1 text-sm font-medium text-paper-raised hover:bg-indigo-soft disabled:opacity-50"
                >
                  承認して反映
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => rejectSuggestion(s.id, messageId))}
                  className="rounded-md border border-line px-3 py-1 text-sm text-ink-muted hover:bg-indigo-deep/5 disabled:opacity-50"
                >
                  却下
                </button>
                {s.model ? (
                  <span className="ml-auto text-[11px] text-ink-muted">{s.model}</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
