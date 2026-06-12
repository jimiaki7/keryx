export type NavItem = {
  href: string;
  label: string;
};

/**
 * グローバルナビゲーション（KERYX_PRODUCT_SPEC §7.1。分析は Phase 3 で追加）。
 * 礼拝予定は月間カレンダー（KX-017）実装までの暫定エントリ。実装後はカレンダーへ統合を検討。
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'ホーム' },
  { href: '/calendar', label: 'カレンダー' },
  { href: '/gatherings', label: '礼拝予定' },
  { href: '/messages', label: 'Messages' },
  { href: '/series', label: 'シリーズ' },
  { href: '/inbox', label: 'Inbox' },
  { href: '/settings', label: '設定' },
];

/** モバイル下部ナビに出す項目（設定は上部バー、礼拝予定はカレンダーページ経由で開く） */
export const BOTTOM_NAV_ITEMS: readonly NavItem[] = NAV_ITEMS.filter(
  (item) => item.href !== '/settings' && item.href !== '/gatherings',
);
