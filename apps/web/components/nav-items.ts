export type NavItem = {
  href: string;
  label: string;
};

/** グローバルナビゲーション（KERYX_PRODUCT_SPEC §7.1。分析は Phase 3 で追加） */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'ホーム' },
  { href: '/calendar', label: 'カレンダー' },
  { href: '/messages', label: 'Messages' },
  { href: '/series', label: 'シリーズ' },
  { href: '/inbox', label: 'Inbox' },
  { href: '/settings', label: '設定' },
];

/** モバイル下部ナビに出す項目（設定はモバイルでは上部バーから開く） */
export const BOTTOM_NAV_ITEMS: readonly NavItem[] = NAV_ITEMS.filter(
  (item) => item.href !== '/settings',
);
