'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BOTTOM_NAV_ITEMS, NAV_ITEMS } from './nav-items';

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

function NavIcon({ href }: { href: string }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (href) {
    case '/':
      return (
        <svg {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
        </svg>
      );
    case '/calendar':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 9.5h18M8 3v4M16 3v4" />
        </svg>
      );
    case '/gatherings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.5 2" />
        </svg>
      );
    case '/messages':
      return (
        <svg {...common}>
          <path d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
          <path d="M14 2v6h6M9 13h6M9 17h6" />
        </svg>
      );
    case '/series':
      return (
        <svg {...common}>
          <path d="m12 3 9 5-9 5-9-5 9-5z" />
          <path d="m3 13.5 9 5 9-5" />
        </svg>
      );
    case '/inbox':
      return (
        <svg {...common}>
          <path d="M5 4h14l3 8v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-7l3-8z" />
          <path d="M2 12h6l2 3h4l2-3h6" />
        </svg>
      );
    case '/settings':
      return (
        <svg {...common}>
          <path d="M4 7h8M18 7h2M4 17h2M12 17h8" />
          <circle cx="15" cy="7" r="2.5" />
          <circle cx="9" cy="17" r="2.5" />
        </svg>
      );
    default:
      return null;
  }
}

/** デスクトップ左サイドバー */
export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="メインナビゲーション" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              active
                ? 'bg-indigo-deep/10 font-medium text-indigo-deep'
                : 'text-ink-muted hover:bg-indigo-deep/5 hover:text-ink'
            }`}
          >
            <NavIcon href={item.href} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** モバイル上部バー（タイトルと設定） */
export function MobileTopBar() {
  const pathname = usePathname();
  const active = isActive(pathname, '/settings');
  return (
    <header className="flex items-center justify-between border-b border-line bg-paper-raised px-4 py-3 md:hidden">
      <Link href="/" className="font-display text-lg font-semibold text-indigo-deep">
        Keryx
      </Link>
      <Link
        href="/settings"
        aria-current={active ? 'page' : undefined}
        aria-label="設定"
        className={`rounded-md p-2 ${active ? 'text-indigo-deep' : 'text-ink-muted'}`}
      >
        <NavIcon href="/settings" />
      </Link>
    </header>
  );
}

/** モバイル下部ナビゲーション */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="メインナビゲーション"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper-raised pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 px-1 py-2 text-[11px] ${
                  active ? 'font-medium text-indigo-deep' : 'text-ink-muted'
                }`}
              >
                <NavIcon href={item.href} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
