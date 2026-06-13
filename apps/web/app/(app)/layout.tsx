import { BottomNav, MobileTopBar, SidebarNav } from '@/components/app-nav';
import { OfflineBanner } from '@/components/offline-banner';
import { getActiveWorkspace } from '@/lib/workspace';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // middleware が未ログインを /login へ誘導する。ここでは workspace を確定する
  const workspace = await getActiveWorkspace();

  return (
    <div className="min-h-dvh md:flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-paper-raised focus:px-3 focus:py-2 focus:text-sm focus:text-indigo-deep focus:shadow"
      >
        本文へスキップ
      </a>
      <aside className="hidden border-r border-line bg-paper-raised px-3 py-6 md:sticky md:top-0 md:flex md:h-dvh md:w-60 md:flex-col">
        <div className="px-3 pb-1">
          <span className="font-display text-xl font-semibold tracking-wide text-indigo-deep">
            Keryx
          </span>
        </div>
        <p className="truncate px-3 pb-5 text-xs text-ink-muted">{workspace.name}</p>
        <SidebarNav />
      </aside>
      <div className="flex min-h-dvh flex-1 flex-col">
        <OfflineBanner />
        <MobileTopBar />
        <main id="main-content" className="flex-1 px-4 py-6 pb-28 md:px-10 md:py-10">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
