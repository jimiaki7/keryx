// Keryx Service Worker（KX-026）
// 方針: 認証済みのユーザーデータ（HTML/RSC/API）はキャッシュしない（他ユーザーへの
// 漏えい・陳腐化を避ける）。キャッシュするのは不変な静的アセットのみ。ナビゲーションは
// network-first で、オフライン時だけ静的なオフラインページを返す。
const CACHE = 'keryx-static-v1';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 不変な静的アセット（content-hash 付き）: cache-first + 背景更新
  if (url.pathname.startsWith('/_next/static/') || url.pathname === '/icon.svg') {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res && res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
    return;
  }

  // ページ遷移: network-first。オフラインで取得できなければオフラインページ。
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
  }
});
