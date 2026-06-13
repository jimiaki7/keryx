'use client';

import { useEffect } from 'react';

/** 本番のみ Service Worker を登録する（dev は HMR と競合するため登録しない）。 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // 登録失敗はアプリ動作を妨げない（オフライン強化はベストエフォート）
      });
    };
    if (document.readyState === 'complete') register();
    else {
      window.addEventListener('load', register);
      return () => window.removeEventListener('load', register);
    }
  }, []);
  return null;
}
