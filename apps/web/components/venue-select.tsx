'use client';

import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from 'react';
import { addVenue, deleteVenue } from '@/app/(app)/messages/venue-actions';

type Venue = { id: string; name: string };

/**
 * Notion のセレクトプロパティ風の会場選択。一覧から選び、自由入力で追加し、一覧から削除できる。
 * フォーム送信用に hidden input（選択中の会場名）を持つ。サーバーアクションが会場を永続化する。
 */
export function VenueSelect({
  name,
  venues,
  defaultValue = '',
  placeholder = '会場を選択',
}: {
  name: string;
  venues: Venue[];
  defaultValue?: string;
  placeholder?: string;
}) {
  const [selected, setSelected] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const q = query.trim();
  const filtered = q
    ? venues.filter((v) => v.name.toLowerCase().includes(q.toLowerCase()))
    : venues;
  const exact = venues.some((v) => v.name === q);

  const choose = (n: string) => {
    setSelected(n);
    setQuery('');
    setOpen(false);
  };

  const create = () => {
    if (!q) return;
    if (exact) {
      choose(q);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await addVenue(q);
      if ('error' in result) {
        setError(result.error);
        return;
      }
      choose(result.name);
    });
  };

  const remove = (v: Venue) => {
    startTransition(async () => {
      await deleteVenue(v.id);
      if (selected === v.name) setSelected('');
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const native = e.nativeEvent as unknown as { isComposing?: boolean; keyCode?: number };
    if (e.key === 'Enter') {
      e.preventDefault();
      if (native.isComposing || native.keyCode === 229) return; // 変換確定では追加しない
      create();
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <input type="hidden" name={name} value={selected} />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-line bg-paper px-3 py-2 text-left text-sm"
      >
        {selected ? (
          <span className="truncate text-ink">{selected}</span>
        ) : (
          <span className="text-ink-muted">{placeholder}</span>
        )}
        <span aria-hidden className="text-ink-muted">
          ▾
        </span>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="会場"
          className="absolute z-30 mt-1 w-72 max-w-[80vw] rounded-md border border-line bg-paper-raised p-1 shadow-lg"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="検索、または新しい会場を入力"
            aria-label="会場を検索または追加"
            // biome/eslint: 意図的な autoFocus（ポップオーバー内の検索）
            autoFocus
            className="mb-1 w-full rounded border border-line bg-paper px-2 py-1.5 text-sm"
          />
          <ul className="max-h-56 overflow-auto">
            <li>
              <button
                type="button"
                onClick={() => choose('')}
                className="w-full rounded px-2 py-1.5 text-left text-sm text-ink-muted hover:bg-indigo-deep/5"
              >
                （会場未設定）{selected === '' ? ' ✓' : ''}
              </button>
            </li>
            {filtered.map((v) => (
              <li key={v.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => choose(v.name)}
                  className="flex-1 truncate rounded px-2 py-1.5 text-left text-sm text-ink hover:bg-indigo-deep/5"
                >
                  {v.name}
                  {selected === v.name ? ' ✓' : ''}
                </button>
                <button
                  type="button"
                  onClick={() => remove(v)}
                  disabled={pending}
                  aria-label={`「${v.name}」を一覧から削除`}
                  className="rounded px-2 py-1 text-ink-muted hover:text-red-800 disabled:opacity-50"
                >
                  ×
                </button>
              </li>
            ))}
            {q && !exact ? (
              <li>
                <button
                  type="button"
                  onClick={create}
                  disabled={pending}
                  className="w-full rounded px-2 py-1.5 text-left text-sm text-indigo-deep hover:bg-indigo-deep/5 disabled:opacity-50"
                >
                  ＋「{q}」を追加
                </button>
              </li>
            ) : null}
          </ul>
          {error ? <p className="px-2 py-1 text-xs text-red-800">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
