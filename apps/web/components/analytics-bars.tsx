// 値を横棒で示す軽量な分布表示（チャートライブラリは使わない）。
// 色だけに意味を持たせず、必ず数値を併記する（アクセシビリティ）。

export type BarItem = { label: string; value: number };

export function BarList({ items, unit = '件' }: { items: BarItem[]; unit?: string }) {
  const max = items.reduce((m, i) => Math.max(m, i.value), 0) || 1;
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((it) => (
        <li key={it.label} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-2 text-sm">
          <span className="truncate text-ink" title={it.label}>
            {it.label}
          </span>
          <span className="h-4 rounded bg-line/40" aria-hidden>
            <span
              className="block h-4 rounded bg-indigo-deep/70"
              style={{ width: `${Math.round((it.value / max) * 100)}%` }}
            />
          </span>
          <span className="text-right tabular-nums text-ink-muted">
            {it.value}
            {unit}
          </span>
        </li>
      ))}
    </ul>
  );
}
