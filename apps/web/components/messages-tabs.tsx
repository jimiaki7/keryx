import Link from 'next/link';

const TABS = [
  { key: 'list', href: '/messages', label: 'メッセージ一覧' },
  { key: 'series', href: '/messages/series', label: 'シリーズ' },
  { key: 'analytics', href: '/messages/analytics', label: '分析' },
] as const;

/** Messages セクション内の切り替えタブ（一覧 / シリーズ / 分析） */
export function MessagesTabs({ active }: { active: (typeof TABS)[number]['key'] }) {
  return (
    <nav aria-label="Messages 内の切り替え" className="flex gap-1 border-b border-line">
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={isActive ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              isActive
                ? 'border-indigo-deep font-medium text-indigo-deep'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
