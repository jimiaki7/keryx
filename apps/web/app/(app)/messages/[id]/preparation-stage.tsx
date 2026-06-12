'use client';

import { useTransition } from 'react';
import { PREPARATION_STAGES } from '@keryx/domain';
import { PREPARATION_STAGE_LABELS } from '@/lib/labels';
import { setPreparationStage } from './actions';

/**
 * 準備段階（ADR-0003）。未着手 → 釈義 → アウトライン → 原稿 → 完了 の
 * 5段階をワンクリックで切り替えるだけのシンプルな表示。
 */
export function PreparationStageControl({
  messageId,
  stage,
}: {
  messageId: string;
  stage: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <section aria-label="準備段階" className="rounded-lg border border-line bg-paper-raised p-4">
      <h2 className="text-sm font-medium text-ink">準備段階</h2>
      <div
        role="group"
        aria-label="準備段階を選択"
        className={`mt-2 flex flex-wrap gap-1 ${pending ? 'opacity-60' : ''}`}
      >
        {PREPARATION_STAGES.map((s, i) => {
          const active = s === stage;
          const reached =
            PREPARATION_STAGES.indexOf(stage as (typeof PREPARATION_STAGES)[number]) >= i;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              disabled={pending}
              onClick={() => startTransition(() => setPreparationStage(messageId, s))}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? 'border-indigo-deep bg-indigo-deep font-medium text-paper-raised'
                  : reached
                    ? 'border-indigo-soft/40 bg-indigo-deep/5 text-indigo-deep hover:bg-indigo-deep/10'
                    : 'border-line text-ink-muted hover:bg-indigo-deep/5'
              }`}
            >
              {PREPARATION_STAGE_LABELS[s]}
            </button>
          );
        })}
      </div>
    </section>
  );
}
