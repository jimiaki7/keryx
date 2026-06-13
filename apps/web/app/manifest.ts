import type { MetadataRoute } from 'next';

// PWA マニフェスト（KX-026）。Next が /manifest.webmanifest として配信し、自動でリンクする。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Keryx — 説教管理ワークスペース',
    short_name: 'Keryx',
    description: '説教計画・礼拝準備・振り返りを一つの流れに統合するワークスペース',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    lang: 'ja',
    background_color: '#faf8f3',
    theme_color: '#1e2a4a',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
