'use client';

import { useActionState, useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { PreparationProgress } from '@keryx/domain';
import {
  addTask,
  deleteTask,
  generateTasks,
  moveTask,
  updateTask,
  type TaskFormState,
} from './actions';

const initialState: TaskFormState = {};

export type TaskItem = {
  id: string;
  title: string;
  status: string;
  due_on: string;
  overdue: boolean;
  notes: string;
};

const STATUS_OPTIONS = [
  { value: 'todo', label: '未着手' },
  { value: 'doing', label: '作業中' },
  { value: 'done', label: '完了' },
  { value: 'skipped', label: 'やらない' },
];

/** 日本語IMEの変換確定Enterでフォームを送信しない */
function preventImeSubmit(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229)) {
    e.preventDefault();
  }
}

const inputClass = 'rounded-md border border-line bg-paper px-3 py-1.5 text-sm';
const iconButtonClass =
  'rounded-md border border-line px-2 py-1.5 text-sm text-ink-muted hover:bg-indigo-deep/5 disabled:opacity-30';

function TaskRow({
  task,
  messageId,
  isFirst,
  isLast,
}: {
  task: TaskItem;
  messageId: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateTask.bind(null, task.id, messageId),
    initialState,
  );
  const muted = task.status === 'done' || task.status === 'skipped';

  return (
    <li className="py-2">
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <select
          name="status"
          defaultValue={task.status}
          aria-label="状態"
          className={`${inputClass} ${task.status === 'done' ? 'text-indigo-deep' : ''}`}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          name="title"
          type="text"
          defaultValue={task.title}
          maxLength={100}
          required
          onKeyDown={preventImeSubmit}
          aria-label="タスク名"
          className={`${inputClass} min-w-28 flex-1 ${muted ? 'text-ink-muted line-through' : ''}`}
        />
        <div className="flex flex-col">
          <input
            name="due_on"
            type="date"
            defaultValue={task.due_on}
            aria-label="期限"
            className={`${inputClass} ${task.overdue ? 'border-red-300 text-red-800' : ''}`}
          />
          {task.overdue ? <span className="text-[10px] text-red-800">期限超過</span> : null}
        </div>
        <input
          name="notes"
          type="text"
          defaultValue={task.notes}
          maxLength={1000}
          placeholder="メモ"
          onKeyDown={preventImeSubmit}
          aria-label="メモ"
          className={`${inputClass} w-32`}
        />
        <button type="submit" disabled={pending} className={iconButtonClass}>
          更新
        </button>
        <button
          type="submit"
          formAction={() => moveTask(task.id, messageId, 'up')}
          disabled={isFirst}
          aria-label="上へ移動"
          className={iconButtonClass}
        >
          ↑
        </button>
        <button
          type="submit"
          formAction={() => moveTask(task.id, messageId, 'down')}
          disabled={isLast}
          aria-label="下へ移動"
          className={iconButtonClass}
        >
          ↓
        </button>
        <button
          type="submit"
          formAction={() => deleteTask(task.id, messageId)}
          aria-label="タスクを削除"
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

export function ProgressBar({ progress }: { progress: PreparationProgress }) {
  return (
    <div className="flex items-center gap-3">
      <div
        role="progressbar"
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="準備進捗"
        className="h-2 flex-1 overflow-hidden rounded-full bg-line"
      >
        <div
          className="h-full rounded-full bg-indigo-deep transition-all"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      <span className="text-xs text-ink-muted">
        {progress.done}/{progress.total}（{progress.percent}%）
      </span>
    </div>
  );
}

export function PreparationTasks({
  messageId,
  tasks,
  progress,
}: {
  messageId: string;
  tasks: TaskItem[];
  progress: PreparationProgress;
}) {
  const [addState, addAction, addPending] = useActionState(
    addTask.bind(null, messageId),
    initialState,
  );
  const addFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (addState.ok) addFormRef.current?.reset();
  }, [addState.ok, addState.nonce]);

  return (
    <section aria-label="準備タスク" className="rounded-lg border border-line bg-paper-raised p-4">
      <h2 className="text-sm font-medium text-ink">準備タスク</h2>
      <div className="mt-2">
        <ProgressBar progress={progress} />
      </div>
      {tasks.length > 0 ? (
        <ol className="mt-2 divide-y divide-line">
          {tasks.map((t, i) => (
            <TaskRow
              key={t.id}
              task={t}
              messageId={messageId}
              isFirst={i === 0}
              isLast={i === tasks.length - 1}
            />
          ))}
        </ol>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-ink-muted">まだ準備タスクがありません。</p>
          <form>
            <button
              type="submit"
              formAction={() => generateTasks(messageId)}
              className="rounded-md border border-line px-3 py-1.5 text-sm text-indigo-deep hover:bg-indigo-deep/5"
            >
              種別テンプレートから生成
            </button>
          </form>
        </div>
      )}
      <form ref={addFormRef} action={addAction} className="mt-3 flex flex-wrap items-center gap-2">
        <input
          name="title"
          type="text"
          maxLength={100}
          required
          placeholder="タスクを追加（例: 投影資料）"
          onKeyDown={preventImeSubmit}
          aria-label="追加するタスク名"
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
