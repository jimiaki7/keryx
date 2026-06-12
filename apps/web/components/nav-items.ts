export type NavItem = {
  href: string;
  label: string;
};

/**
 * グローバルナビゲーション。Jimi のフィードバック（2026-06-12）により4項目へ簡素化:
 * - 礼拝予定の一覧・作成はカレンダーへ統合（/gatherings/[id] プランナーは残る）
 * - Inbox は Messages のフィルタへ、シリーズは Messages のタブへ統合
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'ホーム' },
  { href: '/calendar', label: 'カレンダー' },
  { href: '/messages', label: 'Messages' },
  { href: '/settings', label: '設定' },
];

/** モバイル下部ナビ（設定は上部バーのアイコンから） */
export const BOTTOM_NAV_ITEMS: readonly NavItem[] = NAV_ITEMS.filter(
  (item) => item.href !== '/settings',
);
