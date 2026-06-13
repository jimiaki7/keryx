'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { CEREMONY_TYPE_LABELS, SERVICE_ELEMENT_TYPE_LABELS } from '@/lib/labels';
import { SERVICE_TEMPLATES } from '@/lib/service-templates';
import {
  addElement,
  applyServiceTemplate,
  deleteElement,
  duplicateElement,
  moveElement,
  updateElementTitle,
  type SimpleFormState,
} from '../actions';

const initialState: SimpleFormState = {};

export type ElementItem = {
  id: string;
  type: string;
  title: string;
  position: number;
  metadata: { ceremony_type?: string } | null;
};

const TYPE_OPTIONS = Object.entries(SERVICE_ELEMENT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const CEREMONY_OPTIONS = Object.entries(CEREMONY_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/** 日本語IMEの変換確定Enterでフォームを送信しない */
function preventImeSubmit(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229)) {
    e.preventDefault();
  }
}

const inputClass = 'rounded-md border border-line bg-paper px-3 py-1.5 text-sm';
const iconButtonClass =
  'rounded-md border border-line px-2 py-1.5 text-sm text-ink-muted hover:bg-indigo-deep/5 disabled:opacity-30';

function ElementRow({
  element,
  gatheringId,
  isFirst,
  isLast,
  index,
}: {
  element: ElementItem;
  gatheringId: string;
  isFirst: boolean;
  isLast: boolean;
  index: number;
}) {
  const [state, formAction, pending] = useActionState(
    updateElementTitle.bind(null, element.id, gatheringId),
    initialState,
  );
  const ceremonyType = element.metadata?.ceremony_type;

  return (
    <li className="py-2">
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <span className="w-6 text-right text-xs text-ink-muted">{index + 1}.</span>
        <span className="w-20 shrink-0 rounded-full border border-line px-2 py-0.5 text-center text-xs text-indigo-deep">
          {SERVICE_ELEMENT_TYPE_LABELS[element.type] ?? element.type}
        </span>
        {ceremonyType ? (
          <span className="text-xs text-gold">
            {CEREMONY_TYPE_LABELS[ceremonyType] ?? ceremonyType}
          </span>
        ) : null}
        <input
          name="title"
          type="text"
          defaultValue={element.title}
          maxLength={200}
          placeholder="内容（賛美番号・担当など）"
          onKeyDown={preventImeSubmit}
          aria-label={`${SERVICE_ELEMENT_TYPE_LABELS[element.type] ?? element.type}の内容`}
          className={`${inputClass} min-w-36 flex-1`}
        />
        <button type="submit" disabled={pending} className={iconButtonClass}>
          更新
        </button>
        <button
          type="submit"
          formAction={() => moveElement(element.id, gatheringId, 'up')}
          disabled={isFirst}
          aria-label="上へ移動"
          className={iconButtonClass}
        >
          ↑
        </button>
        <button
          type="submit"
          formAction={() => moveElement(element.id, gatheringId, 'down')}
          disabled={isLast}
          aria-label="下へ移動"
          className={iconButtonClass}
        >
          ↓
        </button>
        <button
          type="submit"
          formAction={() => duplicateElement(element.id, gatheringId)}
          aria-label="複製"
          className={iconButtonClass}
        >
          複製
        </button>
        <button
          type="submit"
          formAction={() => deleteElement(element.id, gatheringId)}
          aria-label="削除"
          className={`${iconButtonClass} text-red-800`}
        >
          削除
        </button>
      </form>
      {state.error ? (
        <div role="alert" className="mt-1 rounded-md bg-red-50 px-3 py-1.5 text-xs text-red-800">
          {state.error}
        </div>
      ) : null}
    </li>
  );
}

export function ElementsEditor({
  gatheringId,
  elements,
  caption,
}: {
  gatheringId: string;
  elements: ElementItem[];
  // 埋め込み先（メッセージ詳細など）で、どの礼拝予定の順序かを示す任意ラベル
  caption?: string;
}) {
  const [addState, addAction, addPending] = useActionState(
    addElement.bind(null, gatheringId),
    initialState,
  );
  const addFormRef = useRef<HTMLFormElement>(null);
  const [addType, setAddType] = useState('hymn');

  useEffect(() => {
    if (addState.ok) addFormRef.current?.reset();
  }, [addState.ok, addState.nonce]);

  return (
    <section aria-label="礼拝順序" className="rounded-lg border border-line bg-paper-raised p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-sm font-medium text-ink">礼拝順序</h2>
          {caption ? <span className="text-xs text-ink-muted">{caption}</span> : null}
        </div>
        <TemplateApplyForm gatheringId={gatheringId} hasElements={elements.length > 0} />
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        賛美や式典は何度でも追加でき、↑↓で自由に並べ替えられます。
      </p>
      {elements.length > 0 ? (
        <ol className="mt-2 divide-y divide-line">
          {elements.map((el, i) => (
            <ElementRow
              key={el.id}
              element={el}
              gatheringId={gatheringId}
              index={i}
              isFirst={i === 0}
              isLast={i === elements.length - 1}
            />
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">まだ要素がありません。下から追加できます。</p>
      )}

      <form ref={addFormRef} action={addAction} className="mt-3 flex flex-wrap items-center gap-2">
        <label htmlFor="element-type" className="sr-only">
          要素タイプ
        </label>
        <select
          id="element-type"
          name="type"
          value={addType}
          onChange={(e) => setAddType(e.target.value)}
          className={inputClass}
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {addType === 'ceremony' ? (
          <select
            name="ceremony_type"
            defaultValue="communion"
            aria-label="式典の種類"
            className={inputClass}
          >
            {CEREMONY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : null}
        <input
          name="title"
          type="text"
          maxLength={200}
          placeholder={
            addType === 'custom' ? '要素の名前（必須）' : '内容（任意。例: 讃美歌21 493）'
          }
          onKeyDown={preventImeSubmit}
          aria-label="要素の内容"
          className={`${inputClass} min-w-40 flex-1`}
        />
        <button
          type="submit"
          disabled={addPending}
          className="rounded-md bg-indigo-deep px-3 py-1.5 text-sm font-medium text-paper-raised hover:bg-indigo-soft disabled:opacity-50"
        >
          {addPending ? '追加中…' : '追加'}
        </button>
      </form>
      {addState.error ? (
        <div role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-1.5 text-sm text-red-800">
          {addState.error}
        </div>
      ) : null}
    </section>
  );
}

function TemplateApplyForm({
  gatheringId,
  hasElements,
}: {
  gatheringId: string;
  hasElements: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    applyServiceTemplate.bind(null, gatheringId),
    initialState,
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          hasElements &&
          !window.confirm('現在の礼拝順序をテンプレートで置き換えます。よろしいですか？')
        ) {
          e.preventDefault();
        }
      }}
      className="flex items-center gap-2"
    >
      <label htmlFor="service-template" className="sr-only">
        テンプレート
      </label>
      <select id="service-template" name="template" defaultValue="" required className={inputClass}>
        <option value="" disabled>
          テンプレート…
        </option>
        {SERVICE_TEMPLATES.map((t) => (
          <option key={t.key} value={t.key}>
            {t.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-line px-3 py-1.5 text-sm text-indigo-deep hover:bg-indigo-deep/5 disabled:opacity-50"
      >
        {pending ? '適用中…' : '適用'}
      </button>
      {state.error ? (
        <span role="alert" className="text-xs text-red-800">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
