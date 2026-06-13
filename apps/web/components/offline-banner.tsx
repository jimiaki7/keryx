'use client';

import { useSyncExternalStore } from 'react';

// ブラウザのオンライン状態を購読する（外部ストアなので useSyncExternalStore が正しい）。
function subscribe(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

/** オフライン時に明確な状態を知らせる帯（§10 network failure 時の明確な状態）。 */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true, // SSR/初期は online と仮定（ハイドレーション不一致を避ける）
  );
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-40 bg-gold/15 px-4 py-1.5 text-center text-xs text-ink"
    >
      オフラインです。表示は最新でない可能性があります。接続が戻ると自動で復帰します。
    </div>
  );
}
